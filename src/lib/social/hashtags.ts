/**
 * Hashtag selection.
 *
 * The bank and the rules come from docs/30-day-social-media-promotion-plan.md section 4, which
 * had never been readable by code. Its rule is specific and worth honouring: pick 3-6 per post
 * and **don't reuse the same stack every day** — an identical tag block on every post is one of
 * the clearer spam signals on Instagram.
 *
 * Chosen here rather than asked of the model, for the same reason the UTM parameters are: a
 * hallucinated hashtag looks exactly like a real one, and #JLPTNS is a dead link.
 *
 * Pure. No `next/*`, no `@/`, no DB.
 */
import { HASHTAGS } from "../brand";
import { getRule, type SurfaceId } from "./platforms";

export const HASHTAG_BANK = HASHTAGS;

export interface PickHashtagsOptions {
  surface: SurfaceId;
  jlptLevel?: string | null;
  contentType?: string | null;
  /** Stacks used recently, so today's post doesn't repeat yesterday's. */
  avoidStacks?: string[][];
  /** Makes selection deterministic for a given brief — same input, same tags, so regenerating
   * copy doesn't silently reshuffle the tags and make a diff unreadable. */
  seed?: string;
}

/** Deterministic 32-bit hash, so `seed` produces a stable rotation without Math.random(). */
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function rotate<T>(items: readonly T[], by: number): T[] {
  if (items.length === 0) return [];
  const offset = by % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

/**
 * Builds a stack for one surface.
 *
 * Composition is deliberate rather than random: one brand tag so the account is findable, the
 * level-specific JLPT tag when we know the level (that is the highest-intent search on these
 * platforms), then broad and niche tags to fill. Broad tags alone are unwinnable; niche tags
 * alone reach nobody.
 */
export function pickHashtags(options: PickHashtagsOptions): string[] {
  const rule = getRule(options.surface);
  if (rule.hashtags.max === 0) return [];

  const target = Math.min(rule.hashtags.max, Math.max(rule.hashtags.min, rule.hashtags.max - 1));
  const seed = hashSeed(options.seed ?? options.surface);

  const picked: string[] = [];
  const push = (tag: string | undefined) => {
    if (!tag) return;
    if (picked.length >= target) return;
    if (picked.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
    picked.push(tag);
  };

  // 1. Brand, always first — rotated so it isn't the identical tag every single time.
  push(rotate(HASHTAG_BANK.brand, seed)[0]);

  // 2. The specific JLPT level, which is the highest-intent tag available.
  const level = options.jlptLevel?.trim().toUpperCase();
  if (level && /^N[1-5]$/.test(level)) push(`#JLPT${level}`);
  else push("#JLPT");

  // 3. Niche tags matched to what the content actually is.
  const type = options.contentType?.toLowerCase() ?? "";
  const nicheFirst = HASHTAG_BANK.niche.filter((t) => {
    const bare = t.slice(1).toLowerCase();
    if (type.includes("kanji")) return bare.includes("kanji");
    if (type.includes("grammar")) return bare.includes("grammar");
    if (type.includes("vocab")) return bare.includes("vocabulary");
    if (type.includes("kana") || type.includes("sound")) return bare.includes("hiragana") || bare.includes("katakana");
    return false;
  });
  for (const tag of nicheFirst) push(tag);

  // 4. Fill from broad, then whatever niche is left, rotating by the seed so consecutive posts
  //    on the same subject don't carry an identical block.
  for (const tag of rotate(HASHTAG_BANK.broad, seed)) push(tag);
  for (const tag of rotate(HASHTAG_BANK.niche, seed)) push(tag);
  for (const tag of rotate(HASHTAG_BANK.jlpt, seed)) push(tag);

  // 5. If this exact stack went out recently, rotate the tail and try once more. One retry is
  //    enough to break a repeat without spiralling into a search for novelty.
  const signature = picked.join(" ").toLowerCase();
  const clashes = (options.avoidStacks ?? []).some((s) => s.join(" ").toLowerCase() === signature);
  if (clashes && picked.length > 2) {
    const head = picked.slice(0, 2);
    const tail = rotate(picked.slice(2), 1);
    return [...head, ...tail];
  }

  return picked;
}
