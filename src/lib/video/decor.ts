/**
 * Choosing which sticker decorates a scene.
 *
 * The library existed for a while with nothing reading it — assets were generated, reviewed and
 * uploaded, and then decorated zero videos. This module is the selection half.
 *
 * SHORTS ONLY. A lesson frame already carries a word, a reading, a meaning, part-of-speech chips
 * and an example; a koi drifting behind that is noise competing with teaching content. A Shorts
 * beat holds one idea for three seconds and has room.
 *
 * The choice is made ONCE, at generation, and frozen onto the scene — same rule as branding and
 * BGM. Two reasons: a re-render must reproduce what was approved, and the Remotion bundle runs in
 * a browser with no database, so anything it needs has to be in the document already.
 */
import type { Scene } from "./types";

export interface DecorAsset {
  slug: string;
  category: string;
  url: string;
  tags: string[];
}

/**
 * Scene types that never get a sticker.
 *
 * The bookends are already the busiest frames in the video — the mascot intro IS a character, the
 * title card is type at display size, and the outro carries a logo, headline, URL pill, follow line
 * and an icon row. Adding a floating object to any of them is the definition of clutter.
 */
const NO_DECOR = new Set(["title_card", "mascot_intro", "cta_outro", "broll_page", "kana_grid"]);

/**
 * Categories eligible as scene decoration.
 *
 * `texture` is excluded because those are full-bleed backgrounds, not cut-outs — one drawn as a
 * corner sticker would be a grey rectangle. `character` is excluded because the corner mascot is
 * already a character, and two of them in one frame reads as a mistake rather than a motif.
 */
const DECOR_CATEGORIES = new Set(["food", "object", "animal"]);

export function decorCandidates(assets: readonly DecorAsset[]): DecorAsset[] {
  return assets.filter((a) => DECOR_CATEGORIES.has(a.category));
}

/**
 * Picks a sticker for one scene.
 *
 * Tag-matched where possible — a lesson about food should get a food object — and otherwise a
 * rotation by index so consecutive scenes do not repeat the same image. Deterministic by
 * construction: the same inputs always produce the same choice, because `Math.random()` would make
 * two renders of one storyboard differ and would break the resume path in the workflow runner.
 *
 * Returns null when there is nothing sensible to use, and null means no sticker rather than a
 * fallback nobody chose.
 */
export function pickDecor(params: {
  sceneType: string;
  index: number;
  /** Free text to match tags against: the item word, its meaning, the topic, the content type. */
  terms: string[];
  assets: readonly DecorAsset[];
}): { slug: string; url: string; corner: "left" | "right" } | null {
  if (NO_DECOR.has(params.sceneType)) return null;
  const pool = decorCandidates(params.assets);
  if (pool.length === 0) return null;

  const haystack = params.terms.join(" ").toLowerCase();

  /**
   * Score, don't just filter.
   *
   * A plain "does any tag appear" test finds far too much: `ramen-bowl` and `banana-sponge` both
   * carry the tag "food", so a lesson about ramen scored them equally and took whichever sorted
   * first — which was the banana cake. Measured, not guessed; that is exactly what the first
   * version returned.
   *
   * So specificity wins. A slug word matching is worth more than a tag, because "ramen" appearing
   * in both the asset name and the lesson is a real signal, and longer tags outweigh short generic
   * ones like "food".
   */
  const score = (a: DecorAsset): number => {
    let n = 0;
    for (const word of a.slug.split("-")) {
      if (word.length > 3 && haystack.includes(word)) n += 10;
    }
    for (const tag of a.tags) {
      const t = tag.toLowerCase();
      if (t.length > 2 && haystack.includes(t)) n += t.length;
    }
    return n;
  };

  const scored = pool.map((a) => ({ a, n: score(a) }));
  const best = Math.max(...scored.map((s) => s.n));
  // Ties rotate by index so a run of beats does not repeat one image; with no match at all
  // (best === 0) that rotation covers the whole pool, which is the intended fallback.
  const from = scored.filter((s) => s.n === best).map((s) => s.a);
  const chosen = from[params.index % from.length];

  return {
    slug: chosen.slug,
    url: chosen.url,
    // Alternated rather than fixed, so a run of beats does not build a stack in one corner. The
    // logo sits top-right and captions sit bottom-centre, so both corners used here are low-left
    // and low-right, away from each.
    // Derived from the SLUG, not the scene index.
    //
    // Index-alternating made the same sticker hop corners between beats of one word — three beats
    // teaching いぬ all pick akita-loyal, and the dog jumped left/right/left across the cuts, which
    // reads as a glitch rather than decoration. Keyed on the slug, one sticker always sits in the
    // same place, and different stickers still spread across both corners.
    corner: chosen.slug.split("").reduce((n, c) => n + c.charCodeAt(0), 0) % 2 === 0 ? "left" : "right",
  };
}

/** Applies `pickDecor` across a storyboard's scenes, in place-free fashion. */
export function decorateScenes(scenes: Scene[], assets: readonly DecorAsset[], terms: string[]): Scene[] {
  let n = 0;
  return scenes.map((scene) => {
    const decor = pickDecor({ sceneType: scene.sceneType, index: n, terms, assets });
    if (decor) n += 1;
    return decor ? { ...scene, decor } : scene;
  });
}

/**
 * Enabled assets, for the generation path.
 *
 * Takes the db handle as a parameter rather than importing it, matching `beatGridForTrack` in
 * ./bgmCatalogue.ts — it keeps this module usable from the worker, the route and a script without
 * three different database imports.
 */
export async function listDecorAssets(
  db: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>
): Promise<DecorAsset[]> {
  const rows = (await db`
    SELECT slug, category, url, tags FROM video_assets WHERE is_enabled ORDER BY slug
  `) as { slug: string; category: string; url: string; tags: string[] | null }[];
  return rows.map((r) => ({ slug: r.slug, category: r.category, url: r.url, tags: r.tags ?? [] }));
}
