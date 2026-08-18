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
    // The trailing pause is part of the scene's length even though no audio plays during it —
    // it is the learner's turn to speak, and cutting it would defeat the point.
    cursor = start + duration + (segment.pauseAfterSeconds ?? 0);
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
    cursor = start + (segment.audio?.durationSeconds ?? 0) + (segment.pauseAfterSeconds ?? 0);
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
  const floor = Math.max(scene.minDurationSeconds ?? 0, MIN_SCENE_SECONDS);
  const narration = sceneNarrationSeconds(scene);
  if (narration <= 0) {
    return Math.max(scene.durationSeconds || MIN_SCENE_SECONDS, floor);
  }
  return Math.max(narration + tailPadding, floor);
}

/**
 * The furthest a cut is moved to reach a beat: half a beat, hard-capped at 250ms.
 *
 * A FIXED 150ms CAP DOES NOT WORK, and measuring it is the only way to see why. Scene lengths are
 * set by measured narration, so a run of similar scenes lands at a near-constant offset from the
 * grid — five 2.833s beats against a 0.5s grid leave a remainder of 0.333s every single time.
 * That is outside a 150ms window at every cut, so quantisation silently never fires and the
 * feature ships inert while looking implemented.
 *
 * Half a beat guarantees the next beat is always reachable, so a cut lands on the grid whenever
 * one exists. The 250ms ceiling keeps a slow track from stalling: at 60 BPM half a beat is 500ms,
 * which would be felt. Below that the extension is silence appended to a scene that already ends
 * with 0.25-0.45s of tail padding, so it reads as pacing rather than as a pause.
 */
function maxBeatShift(periodSeconds: number): number {
  return Math.min(0.25, periodSeconds / 2);
}

interface BeatGrid {
  periodSeconds: number;
  offsetSeconds: number;
}

function beatGrid(storyboard: Storyboard): BeatGrid | null {
  if (storyboard.stylePreset !== "shorts") return null;
  const bpm = storyboard.bgm?.bpm;
  if (!bpm || bpm <= 0) return null;
  return { periodSeconds: 60 / bpm, offsetSeconds: storyboard.bgm?.beatOffsetSeconds ?? 0 };
}

/** Lengthens a scene so it ends on the next beat, when that costs less than MAX_BEAT_SHIFT. */
function quantiseUp(startSeconds: number, seconds: number, beat: BeatGrid): number {
  const end = startSeconds + seconds;
  const since = end - beat.offsetSeconds;
  const nextBeat = beat.offsetSeconds + Math.ceil(since / beat.periodSeconds) * beat.periodSeconds;
  const shift = nextBeat - end;
  return shift > 0 && shift <= maxBeatShift(beat.periodSeconds) ? seconds + shift : seconds;
}

export function buildTimeline(storyboard: Storyboard, options: BuildTimelineOptions): ResolvedTimeline {
  const { fps } = FORMAT_SPECS[options.format];
  const tailPadding = options.tailPaddingSeconds ?? DEFAULT_TAIL_PADDING_SECONDS;

  const sceneFrameSpans: [number, number][] = [];
  // Typed off ResolvedTimeline rather than restated, so the two cannot drift apart again.
  const cues: ResolvedTimeline["cues"] = [];

  // Beat quantisation, Shorts only and only with a measured tempo. A cut that lands on the
  // downbeat reads as intentional; one that lands 200ms off reads as a mistake even to someone
  // who could not name why.
  const beat = beatGrid(storyboard);

  let frameCursor = 0;
  for (const scene of storyboard.scenes) {
    const naturalSeconds = resolveSceneDuration(scene, tailPadding);
    // EXTEND ONLY, NEVER SHORTEN. The narration audio is a fixed-length WAV; taking time away
    // from a scene to reach an earlier beat would cut a word off mid-syllable. So the scene is
    // only ever held slightly longer, and only when the next beat is close enough that the extra
    // hold is imperceptible.
    const seconds = beat
      ? quantiseUp(frameCursor / fps, naturalSeconds, beat)
      : naturalSeconds;
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
        // Measured per-word starts when the TTS layer got them. Relative to the clip, so the
        // caption renderer offsets by cue.start rather than storing absolute times that would
        // have to be rewritten every time a scene above this one changed length.
        words: segment.audio?.words,
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
