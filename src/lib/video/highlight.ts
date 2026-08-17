/**
 * Cuts a Short out of a long video.
 *
 * NOT AN FFMPEG CROP. The obvious reading of "auto-short" is to crop a 16:9 render to 9:16, and
 * that would be strictly worse than what already exists: the pipeline renders vertical natively
 * from the same storyboard, re-laying out the text for the aspect ratio. A crop cannot re-lay out
 * anything — it cuts the sides off finished frames, taking half of every word with them.
 *
 * The real gap is LENGTH. A five-minute lesson has nothing to post to Reels or TikTok, and the
 * useful operation is choosing which 30-60 seconds of it to keep. That is a storyboard operation,
 * not a video one: pick the scenes, build a new storyboard from them, render it normally. The
 * result is a genuine 9:16 video with correct layout, its own captions and its own timing — not a
 * cropped excerpt.
 *
 * Bookends are kept because a Short with no hook and no call to action is a clip, not a video.
 */
import { CHROME_SCENE_IDS } from "./types";
import type { Scene, Storyboard } from "./types";

/** What a platform will actually accept. Reels and TikTok both cap at 90s; 60 is the sweet spot. */
export const HIGHLIGHT_TARGET_SECONDS = 45;
export const HIGHLIGHT_MAX_SECONDS = 90;

export interface HighlightScene {
  id: string;
  sceneType: string;
  /** What the scene is about, for the picker. */
  label: string;
  seconds: number;
  /** Intro, outro and mascot beats — kept by default and not counted as content. */
  isChrome: boolean;
}

function sceneSeconds(scene: Scene, storyboard: Storyboard, index: number): number {
  const span = storyboard.resolved?.sceneFrameSpans[index];
  const fps = storyboard.resolved?.fps ?? 30;
  if (span) return (span[1] - span[0]) / fps;
  // Before a render there is no resolved timeline; the authored duration is the best available.
  return scene.durationSeconds || 0;
}

function label(scene: Scene): string {
  const v = (scene.visual ?? {}) as unknown as Record<string, unknown>;
  const item = v.item as Record<string, unknown> | undefined;
  const found = [v.title, v.heading, v.question, v.headline, v.pattern, v.character, item?.word].find(
    (x) => typeof x === "string" && x.trim()
  ) as string | undefined;
  return (found ?? scene.sceneType.replace(/_/g, " ")).trim().slice(0, 80);
}

/** Every scene with the information the picker needs to choose between them. */
export function listHighlightScenes(storyboard: Storyboard): HighlightScene[] {
  return storyboard.scenes.map((scene, i) => ({
    id: scene.id,
    sceneType: scene.sceneType,
    label: label(scene),
    seconds: Number(sceneSeconds(scene, storyboard, i).toFixed(1)),
    isChrome: CHROME_SCENE_IDS.has(scene.id) || scene.sceneType === "cta_outro" || scene.sceneType === "mascot_intro",
  }));
}

/**
 * Suggests a selection that lands near the target length.
 *
 * Greedy in document order rather than "best" by any score: a Short assembled from scenes 2, 9 and
 * 14 of a lesson makes no sense to watch, because each one assumes the ones before it. Keeping the
 * order and taking a contiguous run from the start of the content preserves the teaching sequence,
 * which is the only thing that makes the clip coherent.
 */
export function suggestHighlight(scenes: HighlightScene[], targetSeconds = HIGHLIGHT_TARGET_SECONDS): string[] {
  const chrome = scenes.filter((s) => s.isChrome);
  const content = scenes.filter((s) => !s.isChrome);
  const chromeSeconds = chrome.reduce((n, s) => n + s.seconds, 0);

  const picked: string[] = [];
  let total = chromeSeconds;
  for (const scene of content) {
    if (total + scene.seconds > targetSeconds && picked.length > 0) break;
    picked.push(scene.id);
    total += scene.seconds;
  }
  // Always at least one content scene, even if it alone overruns the target — a Short of pure
  // intro and outro teaches nothing.
  if (picked.length === 0 && content[0]) picked.push(content[0].id);
  return picked;
}

export interface HighlightResult {
  doc: Storyboard;
  seconds: number;
  sceneCount: number;
  warnings: string[];
}

/**
 * Builds the Short's storyboard from a selection.
 *
 * Scene ids are preserved deliberately. Narration audio is cached by a hash of its text and voice,
 * so a Short cut from a rendered lesson re-uses every clip and costs nothing in TTS — only render
 * minutes. Changing the ids would not break that (the hash is over content, not ids) but it would
 * break the timeline editor's selection state and the artifact rows that point at them.
 */
export function buildHighlight(storyboard: Storyboard, keepSceneIds: string[]): HighlightResult {
  const keep = new Set(keepSceneIds);
  const listed = listHighlightScenes(storyboard);
  const chromeIds = new Set(listed.filter((s) => s.isChrome).map((s) => s.id));

  const scenes = storyboard.scenes.filter((s) => keep.has(s.id) || chromeIds.has(s.id));
  const warnings: string[] = [];

  // Refused, not warned. Chrome is always kept, so an empty selection still yields four scenes —
  // an intro and an outro and nothing between them. Producing that and flagging it would create a
  // project nobody asked for; the honest response to "no scenes chosen" is to decline.
  if (!scenes.some((s) => !chromeIds.has(s.id))) {
    throw new Error("Pick at least one content scene — an intro and outro alone teach nothing.");
  }

  const byId = new Map(listed.map((s) => [s.id, s]));
  const seconds = scenes.reduce((n, s) => n + (byId.get(s.id)?.seconds ?? 0), 0);

  if (seconds > HIGHLIGHT_MAX_SECONDS) {
    warnings.push(
      `${Math.round(seconds)}s is over the ${HIGHLIGHT_MAX_SECONDS}s limit Reels and TikTok enforce — drop a scene.`
    );
  }

  return {
    // `resolved` is cleared: the timeline is rebuilt from the surviving scenes at render time, and
    // keeping the old one would describe a video that no longer exists.
    doc: { ...storyboard, scenes, resolved: undefined },
    seconds: Number(seconds.toFixed(1)),
    sceneCount: scenes.length,
    warnings,
  };
}
