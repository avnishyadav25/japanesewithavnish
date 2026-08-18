/**
 * What changed between two storyboard versions.
 *
 * WHY BOTH THIS AND `change_summary`. The stored summary is exact, because it is written where the
 * change is known — "Repeat 2 → 3" is a fact at the moment of the edit and guesswork afterwards.
 * But it only exists for versions created after the column did, and a project with four versions
 * already had none. This computes an answer from the documents themselves, so history that predates
 * the feature is still explainable.
 *
 * Scenes are matched by `id`, never by position. Ids are stable across edits by design — the type's
 * own comment says reordering must not change them, because TTS cache hits and the timeline
 * editor's selection both key off them — so position-matching would report a reorder as every scene
 * having been rewritten.
 *
 * Isomorphic and dependency-free: the admin renders this in the browser.
 */
import type { NarrationSegment, Scene, Storyboard } from "./types";

export interface SegmentChange {
  segmentId: string;
  lang: string;
  before: string | null;
  after: string | null;
}

export interface SceneChange {
  sceneId: string;
  sceneType: string;
  kind: "added" | "removed" | "changed" | "moved";
  /** Only for `changed`. */
  segments?: SegmentChange[];
  /** Human-readable notes that are not narration text: transition, sticker, reveal. */
  notes?: string[];
}

export interface StoryboardDiff {
  /** One-line facts about the document as a whole. */
  headline: string[];
  scenes: SceneChange[];
  /** True when the two documents are materially identical. */
  identical: boolean;
}

function narrationText(segment: NarrationSegment): string {
  return (segment.text ?? "").trim();
}

function sceneNotes(before: Scene, after: Scene): string[] {
  const notes: string[] = [];
  if (before.sceneType !== after.sceneType) notes.push(`type ${before.sceneType} → ${after.sceneType}`);
  if (before.transitionIn?.kind !== after.transitionIn?.kind) {
    notes.push(`transition ${before.transitionIn?.kind ?? "none"} → ${after.transitionIn?.kind ?? "none"}`);
  }
  if ((before.decor?.slug ?? null) !== (after.decor?.slug ?? null)) {
    notes.push(`sticker ${before.decor?.slug ?? "none"} → ${after.decor?.slug ?? "none"}`);
  }
  const rBefore = (before.visual as { reveal?: string } | undefined)?.reveal;
  const rAfter = (after.visual as { reveal?: string } | undefined)?.reveal;
  if (rBefore !== rAfter) notes.push(`reveal ${rBefore ?? "all"} → ${rAfter ?? "all"}`);
  if (before.durationMode !== after.durationMode) notes.push(`timing ${before.durationMode} → ${after.durationMode}`);
  return notes;
}

function segmentChanges(before: Scene, after: Scene): SegmentChange[] {
  const out: SegmentChange[] = [];
  const beforeById = new Map(before.narration.map((s) => [s.id, s]));
  const afterById = new Map(after.narration.map((s) => [s.id, s]));

  for (const [id, seg] of Array.from(beforeById)) {
    const next = afterById.get(id);
    if (!next) {
      out.push({ segmentId: id, lang: seg.lang, before: narrationText(seg), after: null });
    } else if (narrationText(seg) !== narrationText(next)) {
      out.push({ segmentId: id, lang: seg.lang, before: narrationText(seg), after: narrationText(next) });
    }
  }
  for (const [id, seg] of Array.from(afterById)) {
    if (!beforeById.has(id)) out.push({ segmentId: id, lang: seg.lang, before: null, after: narrationText(seg) });
  }
  return out;
}

export function diffStoryboards(before: Storyboard, after: Storyboard): StoryboardDiff {
  const headline: string[] = [];

  if ((before.stylePreset ?? "lesson") !== (after.stylePreset ?? "lesson")) {
    headline.push(`Pacing ${before.stylePreset ?? "lesson"} → ${after.stylePreset ?? "lesson"}`);
  }
  if (before.scenes.length !== after.scenes.length) {
    headline.push(`${before.scenes.length} → ${after.scenes.length} scenes`);
  }
  if ((before.captions?.mode ?? "line") !== (after.captions?.mode ?? "line")) {
    headline.push(`Captions ${before.captions?.mode ?? "line"} → ${after.captions?.mode ?? "line"}`);
  }
  const jaBefore = before.scenes.reduce((n, s) => n + s.narration.filter((x) => x.lang === "ja").length, 0);
  const jaAfter = after.scenes.reduce((n, s) => n + s.narration.filter((x) => x.lang === "ja").length, 0);
  if (jaBefore !== jaAfter) headline.push(`${jaBefore} → ${jaAfter} Japanese clips`);

  const wordsOf = (sb: Storyboard) =>
    sb.scenes
      .flatMap((s) => s.narration.filter((n) => n.lang !== "ja"))
      .reduce((n, s) => n + narrationText(s).split(/\s+/).filter(Boolean).length, 0);
  const wBefore = wordsOf(before);
  const wAfter = wordsOf(after);
  if (wBefore !== wAfter) headline.push(`${wBefore} → ${wAfter} narration words`);

  const decorBefore = before.scenes.filter((s) => s.decor).length;
  const decorAfter = after.scenes.filter((s) => s.decor).length;
  if (decorBefore !== decorAfter) headline.push(`${decorBefore} → ${decorAfter} scenes with a sticker`);

  const beforeById = new Map(before.scenes.map((s) => [s.id, s]));
  const afterById = new Map(after.scenes.map((s) => [s.id, s]));
  const beforeOrder = before.scenes.map((s) => s.id);
  const afterOrder = after.scenes.map((s) => s.id);

  const scenes: SceneChange[] = [];
  for (const [id, scene] of Array.from(beforeById)) {
    if (!afterById.has(id)) scenes.push({ sceneId: id, sceneType: scene.sceneType, kind: "removed" });
  }
  for (const [id, scene] of Array.from(afterById)) {
    const prev = beforeById.get(id);
    if (!prev) {
      scenes.push({ sceneId: id, sceneType: scene.sceneType, kind: "added" });
      continue;
    }
    const segments = segmentChanges(prev, scene);
    const notes = sceneNotes(prev, scene);
    if (segments.length > 0 || notes.length > 0) {
      scenes.push({ sceneId: id, sceneType: scene.sceneType, kind: "changed", segments, notes });
    } else if (beforeOrder.indexOf(id) !== afterOrder.indexOf(id)) {
      // Only reported when nothing else about the scene changed — a scene that both moved and was
      // rewritten is more usefully described as rewritten.
      scenes.push({ sceneId: id, sceneType: scene.sceneType, kind: "moved" });
    }
  }

  return { headline, scenes, identical: headline.length === 0 && scenes.length === 0 };
}

/** A one-line description, for when there is no stored summary. */
export function describeDiff(diff: StoryboardDiff): string {
  if (diff.identical) return "No change to the script";
  if (diff.headline.length > 0) return diff.headline.join(" · ");
  const changed = diff.scenes.filter((s) => s.kind === "changed").length;
  const added = diff.scenes.filter((s) => s.kind === "added").length;
  const removed = diff.scenes.filter((s) => s.kind === "removed").length;
  return [
    changed > 0 && `${changed} scene${changed === 1 ? "" : "s"} reworded`,
    added > 0 && `${added} added`,
    removed > 0 && `${removed} removed`,
  ]
    .filter(Boolean)
    .join(" · ");
}
