/**
 * Final Cut Pro XML export — the timeline, so a finished video can be re-cut by a human.
 *
 * WHAT FCPXML IS. Apple's interchange format for an editing timeline: which clips exist, where
 * each sits, what part of its source file it shows, and what audio rides alongside. Final Cut Pro
 * opens it natively and DaVinci Resolve (free) imports it, so it is how you hand a
 * machine-generated cut to an editor without re-exporting anything.
 *
 * WHY IT WORKS FROM ONE FLAT MP4. Remotion renders a single file, not per-scene clips — which
 * looks like a blocker and is not. FCPXML clips reference a *sub-range* of an asset via `start`
 * and `duration`, so each scene becomes its own trimmable clip pointing at its own slice of the
 * render. Reordering, deleting or extending a scene in Final Cut then works exactly as if they
 * had been separate files.
 *
 * THE TRAP: TIME IS RATIONAL, NOT DECIMAL. FCPXML writes durations as exact fractions like
 * `300/30s`. A decimal such as `10.0s` is either rejected or silently rounded to the nearest
 * frame, which accumulates into audio drift across a long timeline. Every value here is emitted
 * as `<frames>/<fps>s` computed in integer frames, never in seconds.
 *
 * Version 1.10 targets Final Cut Pro 10.6+ and is what Resolve 18/19 reads most reliably.
 */
import { FORMAT_SPECS, type ResolvedTimeline, type Storyboard, type VideoFormat } from "./types";

/** Escapes text for an XML attribute. Scene names carry Japanese and apostrophes. */
function attr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Frames as an FCPXML time value.
 *
 * `0s` rather than `0/30s` because Final Cut writes plain zero and some importers are fussy about
 * a zero numerator.
 */
export function frameTime(frames: number, fps: number): string {
  const n = Math.max(0, Math.round(frames));
  return n === 0 ? "0s" : `${n}/${fps}s`;
}

/** Seconds to whole frames. Everything downstream is integer frames, so rounding happens once. */
function toFrames(seconds: number, fps: number): number {
  return Math.max(0, Math.round(seconds * fps));
}

export interface FcpxmlInput {
  storyboard: Storyboard;
  timeline: ResolvedTimeline;
  format: VideoFormat;
  /** Relative path inside the bundle, e.g. "video.mp4". */
  videoHref: string;
  /** Per narration segment id, the relative path of its WAV inside the bundle. */
  audioHrefs?: Map<string, string>;
  projectTitle: string;
}

/**
 * Builds the FCPXML document.
 *
 * Structure, which is fixed by the format: resources (the format and every asset) → library →
 * event → project → sequence → spine. Scene clips sit on the spine in order; narration WAVs hang
 * off them as connected clips with a negative lane, which is how Final Cut represents audio
 * attached to a video clip rather than occupying the main storyline.
 */
export function buildFcpxml(input: FcpxmlInput): string {
  const { storyboard, timeline, format, videoHref, audioHrefs, projectTitle } = input;
  const spec = FORMAT_SPECS[format];
  const fps = timeline.fps || spec.fps;
  const totalFrames = timeline.totalFrames;

  // Apple's naming convention for a progressive format; the id is referenced by every clip.
  const formatId = "r0";
  const formatName = `FFVideoFormat${spec.height}p${fps}`;

  const resources: string[] = [
    `    <format id="${formatId}" name="${attr(formatName)}" frameDuration="1/${fps}s" ` +
      `width="${spec.width}" height="${spec.height}" colorSpace="1-1-1 (Rec. 709)"/>`,
    `    <asset id="a0" name="${attr(projectTitle)}" start="0s" duration="${frameTime(totalFrames, fps)}" ` +
      `hasVideo="1" hasAudio="1" format="${formatId}" videoSources="1" audioSources="1" audioChannels="2" audioRate="48000">`,
    `      <media-rep kind="original-media" src="${attr(videoHref)}"/>`,
    `    </asset>`,
  ];

  // One asset per narration clip. Declared even when the bundle has no WAV for a segment, so the
  // ids stay stable and a missing file shows in Final Cut as one offline clip rather than
  // shifting everything after it.
  const audioAssets: { id: string; segmentId: string; href: string; frames: number }[] = [];
  let audioIndex = 0;
  for (const scene of storyboard.scenes) {
    for (const segment of scene.narration) {
      const href = audioHrefs?.get(segment.id);
      if (!href || !segment.audio?.durationSeconds) continue;
      const id = `a${++audioIndex}`;
      const frames = toFrames(segment.audio.durationSeconds, fps);
      audioAssets.push({ id, segmentId: segment.id, href, frames });
      resources.push(
        `    <asset id="${id}" name="${attr(segment.id)}" start="0s" duration="${frameTime(frames, fps)}" ` +
          `hasVideo="0" hasAudio="1" audioSources="1" audioChannels="1" audioRate="24000">`,
        `      <media-rep kind="original-media" src="${attr(href)}"/>`,
        `    </asset>`
      );
    }
  }
  const audioBySegment = new Map(audioAssets.map((a) => [a.segmentId, a]));

  // Scene clips. `offset` is the position on the timeline, `start` the point inside the source
  // file — identical here because the scenes are consecutive slices of one continuous render.
  const spine: string[] = [];
  storyboard.scenes.forEach((scene, i) => {
    const span = timeline.sceneFrameSpans[i];
    if (!span) return;
    const [from, to] = span;
    const frames = Math.max(1, to - from);
    const name = `${i + 1}. ${scene.sceneType}`;

    const connected: string[] = [];
    // Audio is attached to its scene rather than laid on the spine, so moving a scene in Final Cut
    // carries its narration with it. lane="-1" is the first audio lane below the video.
    let audioOffset = 0;
    for (const segment of scene.narration) {
      const asset = audioBySegment.get(segment.id);
      if (!asset) continue;
      const lead = toFrames(segment.leadInSeconds ?? 0, fps);
      connected.push(
        `        <asset-clip ref="${asset.id}" lane="-1" offset="${frameTime(from + audioOffset + lead, fps)}" ` +
          `name="${attr(segment.id)}" start="0s" duration="${frameTime(asset.frames, fps)}" audioRole="dialogue"/>`
      );
      audioOffset += lead + asset.frames + toFrames(segment.pauseAfterSeconds ?? 0, fps);
    }

    spine.push(
      `      <asset-clip ref="a0" offset="${frameTime(from, fps)}" name="${attr(name)}" ` +
        `start="${frameTime(from, fps)}" duration="${frameTime(frames, fps)}" format="${formatId}" tcFormat="NDF">`,
      // A marker per scene, so the scene list is visible in Final Cut's timeline index even after
      // the clips have been re-cut.
      `        <marker start="${frameTime(from, fps)}" duration="${frameTime(1, fps)}" value="${attr(name)}"/>`,
      ...connected,
      `      </asset-clip>`
    );
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.10">
  <resources>
${resources.join("\n")}
  </resources>
  <library>
    <event name="${attr(projectTitle)}">
      <project name="${attr(projectTitle)} (${format})">
        <sequence format="${formatId}" duration="${frameTime(totalFrames, fps)}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">
          <spine>
${spine.join("\n")}
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>
`;
}

/**
 * Chapter markers, in the format YouTube expects in a description.
 *
 * Far more useful day to day than the FCPXML and nearly free to produce, since it is the same
 * scene-boundary data. YouTube requires the first entry to be 0:00 or it ignores the whole list.
 */
export function buildChapters(storyboard: Storyboard, timeline: ResolvedTimeline): string {
  const lines: string[] = [];
  storyboard.scenes.forEach((scene, i) => {
    const span = timeline.sceneFrameSpans[i];
    if (!span) return;
    const seconds = Math.floor(span[0] / (timeline.fps || 30));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const stamp = h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
    lines.push(`${stamp} ${sceneLabel(scene, i)}`);
  });
  // YouTube ignores a chapter list whose first stamp is not 0:00.
  if (lines.length > 0 && !lines[0].startsWith("0:00")) {
    lines[0] = `0:00 ${lines[0].slice(lines[0].indexOf(" ") + 1)}`;
  }
  return lines.join("\n");
}

/**
 * What a chapter is called.
 *
 * The scene TYPE is useless here — a vocabulary video would list "Title card" eight times, which
 * is worse than no chapters at all. The visual carries the actual subject (the word, the kanji,
 * the pattern), so that is what a viewer scrubbing the bar needs to see.
 */
function sceneLabel(scene: { sceneType: string; visual?: unknown }, index: number): string {
  const v = (scene.visual ?? {}) as Record<string, unknown>;
  const item = v.item as Record<string, unknown> | undefined;

  const candidate =
    [v.title, v.heading, v.question, v.headline, v.pattern, v.character, item?.word]
      .find((x) => typeof x === "string" && x.trim()) as string | undefined;

  if (candidate) return candidate.trim().slice(0, 90);
  if (index === 0) return "Introduction";
  const pretty = scene.sceneType.replace(/_/g, " ");
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}
