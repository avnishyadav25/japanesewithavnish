/**
 * Video Studio — brand marks, resolved.
 *
 * Bridges `@/lib/brand` (which knows the handle and the accounts) to the storyboard document
 * (which needs those values frozen at authoring time). Kept separate from `brand.ts` so the
 * site-wide brand module stays free of video concepts, and separate from `storyboard.ts` so the
 * Remotion tree can import it without pulling in the DeepSeek client.
 *
 * No `next/*` imports and relative paths only: the render worker loads this under plain tsx.
 */
import { BRAND, SOCIALS } from "../brand";
import type { BrandingSettings, VideoFormat } from "./types";

/**
 * What a new storyboard gets.
 *
 * `badge` at 0.7 opacity was chosen over the smaller symbol-only mark: the ring lettering is not
 * legible at watermark size either way, but the badge silhouette is what people recognise from
 * the site header, and recognition is the entire job of a watermark.
 */
export const DEFAULT_BRANDING: BrandingSettings = {
  logo: "badge",
  logoOpacity: 0.7,
  hashtag: BRAND.hashtag,
  handle: BRAND.atHandle,
  socials: SOCIALS.filter((s) => s.inVideoOutro).map((s) => s.platform),
  mascots: true,
};

/**
 * Floor for the outro scene, in seconds.
 *
 * The outro carries a logo, headline, subline, URL pill, follow line and an icon row, each on a
 * staggered entrance. Sized off its closing line alone it lands around two seconds, which is not
 * enough time to read a handle — the addition would be there and unusable.
 */
export const OUTRO_MIN_SECONDS = 4;

/**
 * The mascot intro beat, in seconds.
 *
 * Fixed, and deliberately short. It buys the first-second hook a Reel lives or dies on, but it
 * is 2.5 seconds taken from a 60-second short — long enough for the character to arrive and the
 * topic to land, short enough that nobody scrubs past it. Counted by `estimateStoryboardDuration`
 * like any other scene, so the forecast includes it rather than drifting.
 */
export const MASCOT_INTRO_SECONDS = 2.5;

/** Fills in defaults for a storyboard authored before `branding` existed, or one that only
 * overrides a field or two. */
export function resolveBranding(branding?: Partial<BrandingSettings> | null): BrandingSettings {
  return { ...DEFAULT_BRANDING, ...(branding ?? {}) };
}

/**
 * Whether the hashtag is burned into the frame for this output format.
 *
 * Vertical and square only. A hashtag burned into a 16:9 YouTube upload reads as spam — there it
 * belongs in the description, where it is also clickable. Shorts and Reels get screenshotted and
 * reshared stripped of their caption, which is exactly when an on-frame hashtag earns its place.
 */
export function showsHashtag(format: VideoFormat, branding: BrandingSettings): boolean {
  if (!branding.hashtag) return false;
  return format === "vertical" || format === "square";
}

/**
 * The static asset for the chosen logo treatment, relative to `public/`.
 *
 * Both files are 500x500 with real transparency. `logo-dark.png` is misleadingly named — it is
 * not a dark-mode variant, it is the same artwork with the navy ring and lettering removed.
 */
export function logoAsset(branding: BrandingSettings): string | null {
  if (branding.logo === "none") return null;
  return branding.logo === "symbol" ? "logo-dark.png" : "logo.png";
}
