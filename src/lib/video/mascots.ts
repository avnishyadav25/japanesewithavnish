/**
 * Which mascot appears where.
 *
 * The cast lives in `public/mascots/` as transparent PNGs, generated and matted by
 * `scripts/generate-mascots.ts`. This module is the only place that knows their filenames, so a
 * renamed or added mascot is a one-line change rather than a grep.
 *
 * No `next/*`, no `@/` — the Remotion tree and the worker both import this.
 */

export type MascotId =
  | "fox-wave"
  | "fox-point"
  | "fox-celebrate"
  | "tanuki-write"
  | "tanuki-think"
  | "owl-point"
  | "owl-think"
  | "red-panda-wave"
  // Second cast. Declared here before the art exists so the picker can offer them and
  // scripts/generate-mascots.ts has a target list; `availableMascots()` below is what any
  // renderer should use, since it filters to ids whose PNG is actually on disk.
  | "cat-point"
  | "cat-bow"
  | "shiba-celebrate"
  | "shiba-wave"
  | "crane-think"
  | "crane-bow"
  | "rabbit-read"
  | "rabbit-wave";

/** Every id the cast defines. Not every one necessarily has art yet — see GENERATED. */
export const MASCOTS: readonly MascotId[] = [
  "fox-wave", "fox-point", "fox-celebrate", "tanuki-write", "tanuki-think",
  "owl-point", "owl-think", "red-panda-wave",
  "cat-point", "cat-bow", "shiba-celebrate", "shiba-wave",
  "crane-think", "crane-bow", "rabbit-read", "rabbit-wave",
];

/**
 * The ids with a PNG in public/mascots.
 *
 * Maintained by hand rather than read from disk on purpose: this module is imported by the
 * Remotion tree, which is bundled for the browser and has no filesystem. A mascot referenced but
 * missing renders as a broken <Img> mid-video, which is worse than not offering it.
 */
export const GENERATED: readonly MascotId[] = [
  "fox-wave", "fox-point", "fox-celebrate", "tanuki-write", "tanuki-think",
  "owl-point", "owl-think", "red-panda-wave",
];

export function isGenerated(id: string): id is MascotId {
  return (GENERATED as readonly string[]).includes(id);
}

/** Path relative to `public/`, for `staticFile()`. */
export function mascotAsset(id: MascotId): string {
  return `mascots/${id}.png`;
}

/**
 * The corner mascot for a teaching scene, by scene type.
 *
 * Cast by subject rather than at random, so the same character reliably teaches the same thing:
 * the owl professor explains grammar, the fox introduces vocabulary, the tanuki does the
 * handwriting. Consistency is most of what makes a mascot read as a character rather than
 * decoration.
 *
 * `null` means no corner mascot — scenes that are already dense, or that carry their own
 * (title card, outro, b-roll).
 */
export const MASCOT_BY_SCENE_TYPE: Record<string, MascotId | null> = {
  // Vocabulary — the fox introduces
  vocab_card: "fox-point",
  vocab_list: "fox-point",
  example_sentence: "fox-point",

  // Grammar — the owl professor explains
  grammar_pattern: "owl-point",
  grammar_formation: "owl-point",
  comparison: "owl-think",

  // Kanji and writing — the tanuki writes
  kanji_stroke: "tanuki-write",
  kanji_detail: "tanuki-write",
  kana_grid: "tanuki-write",

  // Callouts — a thinking pose suits a caveat better than a pointing one
  tip_callout: "tanuki-think",
  common_mistake: "owl-think",
  culture_note: "red-panda-wave",

  quiz_question: "owl-think",
  summary_recap: "fox-celebrate",

  // These carry their own art, or are too busy to share the frame.
  title_card: null,
  mascot_intro: null,
  cta_outro: null,
  broll_page: null,
  dialogue: null,
  reading_passage: null,
  listening_prompt: null,
};

export function mascotForScene(sceneType: string): MascotId | null {
  return MASCOT_BY_SCENE_TYPE[sceneType] ?? null;
}

/** Greeting spoken over the intro beat, per narration language. */
export const MASCOT_GREETING: Record<string, { ja: string; romaji: string }> = {
  en: { ja: "こんにちは", romaji: "konnichiwa" },
  hi: { ja: "こんにちは", romaji: "konnichiwa" },
  ja: { ja: "こんにちは", romaji: "konnichiwa" },
};
