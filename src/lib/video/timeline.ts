/**
 * Video Studio — turns measured narration durations into a frame-accurate timeline.
 *
 * Runs after the TTS stage and before the render stage. Everything downstream (Remotion
 * <Sequence> spans, burned-in captions, the .srt/.vtt sidecars, the reported video length)
 * reads `Storyboard.resolved` rather than recomputing timing, so there is exactly one place
 * where seconds become frames and rounding can drift.
 *
 * No `next/*` imports — the worker calls this directly.
 */
import type { NarrationLang, ResolvedTimeline, Scene, Storyboard, VideoFormat } from "./types";
import { FORMAT_SPECS } from "./types";

/** Breathing room after the last word of a scene so cuts don't clip the tail of the audio. */
const DEFAULT_TAIL_PADDING_SECONDS = 0.45;
/** A scene with no narration at all (a pure B-roll beat) still needs to be on screen. */
const MIN_SCENE_SECONDS = 1.2;

export interface BuildTimelineOptions {
  format: VideoFormat;
  tailPaddingSeconds?: number;
}

/** Sum of narration audio for a scene, honouring per-segment lead-in silence. Segments play
 * sequentially unless a segment pins itself with `startOffsetSeconds`. */
export function sceneNarrationSeconds(scene: Scene): number {
  let cursor = 0;
  let end = 0;
  for (const segment of scene.narration) {
    const lead = segment.leadInSeconds ?? 0;
    const duration = segment.audio?.durationSeconds ?? 0;
    const start = cursor + lead;
    cursor = start + duration;
    end = Math.max(end, cursor);
  }
  return end;
}

/** Per-segment start times within a scene, in the same order as `scene.narration`. Remotion
 * needs these to offset each <Audio> inside the scene's <Sequence>. */
export function segmentOffsets(scene: Scene): number[] {
  const offsets: number[] = [];
  let cursor = 0;
  for (const segment of scene.narration) {
    const start = cursor + (segment.leadInSeconds ?? 0);
    offsets.push(start);
    cursor = start + (segment.audio?.durationSeconds ?? 0);
  }
  return offsets;
}

/**
 * Effective on-screen duration for a scene.
 *
 * `fixed` means a human dragged the clip edge in the timeline editor, so their number wins
 * even if it clips narration — that is a deliberate editorial choice, not a bug. `auto`
 * derives from measured audio and is never shorter than the narration it has to carry.
 */
export function resolveSceneDuration(scene: Scene, tailPadding: number): number {
  if (scene.durationMode === "fixed") {
    return Math.max(scene.durationSeconds, 1 / 30);
  }
  const narration = sceneNarrationSeconds(scene);
  if (narration <= 0) {
    return Math.max(scene.durationSeconds || MIN_SCENE_SECONDS, MIN_SCENE_SECONDS);
  }
  return narration + tailPadding;
}

export function buildTimeline(storyboard: Storyboard, options: BuildTimelineOptions): ResolvedTimeline {
  const { fps } = FORMAT_SPECS[options.format];
  const tailPadding = options.tailPaddingSeconds ?? DEFAULT_TAIL_PADDING_SECONDS;

  const sceneFrameSpans: [number, number][] = [];
  const cues: { start: number; end: number; text: string; lang: NarrationLang }[] = [];

  let frameCursor = 0;
  for (const scene of storyboard.scenes) {
    const seconds = resolveSceneDuration(scene, tailPadding);
    // Frames, not seconds, are the unit of truth from here on: accumulating rounded frame
    // counts keeps scene N's start exactly equal to scene N-1's end, whereas rounding each
    // boundary from a running seconds total drifts by up to a frame per scene.
    const frames = Math.max(1, Math.round(seconds * fps));
    const start = frameCursor;
    const end = frameCursor + frames;
    sceneFrameSpans.push([start, end]);

    const sceneStartSeconds = start / fps;
    const offsets = segmentOffsets(scene);
    scene.narration.forEach((segment, i) => {
      const duration = segment.audio?.durationSeconds ?? 0;
      if (duration <= 0 || !segment.text.trim()) return;
      cues.push({
        start: sceneStartSeconds + offsets[i],
        end: sceneStartSeconds + offsets[i] + duration,
        text: segment.text.trim(),
        lang: segment.lang,
      });
    });

    frameCursor = end;
  }

  return {
    fps,
    totalFrames: Math.max(1, frameCursor),
    sceneFrameSpans,
    cues,
    resolvedAt: new Date().toISOString(),
  };
}

/** Attaches a freshly built timeline without mutating the input. */
export function withResolvedTimeline(storyboard: Storyboard, options: BuildTimelineOptions): Storyboard {
  return { ...storyboard, resolved: buildTimeline(storyboard, options) };
}

// ---------------------------------------------------------------------------
// Caption sidecars
// ---------------------------------------------------------------------------

function formatTimestamp(seconds: number, msSeparator: "," | "."): string {
  const clamped = Math.max(0, seconds);
  const hh = Math.floor(clamped / 3600);
  const mm = Math.floor((clamped % 3600) / 60);
  const ss = Math.floor(clamped % 60);
  const ms = Math.round((clamped - Math.floor(clamped)) * 1000);
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}${msSeparator}${pad(ms, 3)}`;
}

export function toSrt(timeline: ResolvedTimeline): string {
  return timeline.cues
    .map((cue, i) =>
      [
        String(i + 1),
        `${formatTimestamp(cue.start, ",")} --> ${formatTimestamp(cue.end, ",")}`,
        cue.text,
        "",
      ].join("\n")
    )
    .join("\n");
}

export function toVtt(timeline: ResolvedTimeline): string {
  const body = timeline.cues
    .map((cue) => `${formatTimestamp(cue.start, ".")} --> ${formatTimestamp(cue.end, ".")}\n${cue.text}\n`)
    .join("\n");
  return `WEBVTT\n\n${body}`;
}

/** The caption visible at a given frame, for burned-in rendering. */
export function cueAtFrame(timeline: ResolvedTimeline, frame: number): string | null {
  const t = frame / timeline.fps;
  for (const cue of timeline.cues) {
    if (t >= cue.start && t < cue.end) return cue.text;
  }
  return null;
}
