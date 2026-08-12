/**
 * Video Studio — theme tokens for Remotion scenes.
 *
 * The default theme mirrors tailwind.config.ts so generated video reads as the same product as
 * the site. Themes are stored in `video_themes.tokens` and passed into the composition as a
 * prop; this file only supplies the fallback and the layout scale.
 *
 * Scenes use inline styles from here rather than Tailwind classes. Two reasons: Remotion
 * bundles this tree outside Next's PostCSS pipeline, and — more importantly — CSS transitions
 * and keyframe animations are wall-clock driven, so they render non-deterministically when
 * Chrome is stepped frame by frame. All motion goes through Remotion's interpolate/spring.
 */
import type { VideoThemeTokens } from "@/lib/video/types";

export const DEFAULT_THEME: VideoThemeTokens = {
  bg: "#FAF8F5",
  surface: "#FFFFFF",
  primary: "#D0021B",
  primaryHover: "#A00016",
  accent: "#C8A35F",
  text: "#1A1A1A",
  textMuted: "#555555",
  textSubtle: "#888888",
  border: "#f0ece6",
  radius: 20,
  fontSans: "DM Sans",
  fontSerif: "DM Serif Display",
  fontJa: "Noto Sans JP",
};

export type SceneLayout = "vertical" | "landscape" | "square";

/**
 * Type scale per layout. A 9:16 phone frame is viewed small and needs proportionally larger
 * type than a 16:9 frame viewed on a laptop; hardcoding one scale and letting CSS shrink it
 * produces vertical videos that are unreadable on a phone.
 */
export interface LayoutScale {
  /** Outer padding in px. */
  pad: number;
  /** Base font size the rest of the scale is derived from. */
  base: number;
  displayJa: number;
  headline: number;
  title: number;
  body: number;
  caption: number;
  gap: number;
  /** Scenes stack vertically at 9:16 and can go side-by-side at 16:9. */
  stack: boolean;
  maxContentWidth: number;
}

export const LAYOUT_SCALES: Record<SceneLayout, LayoutScale> = {
  vertical: {
    pad: 88,
    base: 44,
    displayJa: 190,
    headline: 84,
    title: 62,
    body: 44,
    caption: 40,
    gap: 34,
    stack: true,
    maxContentWidth: 904,
  },
  landscape: {
    pad: 96,
    base: 34,
    displayJa: 168,
    headline: 74,
    title: 52,
    body: 36,
    caption: 32,
    gap: 28,
    stack: false,
    maxContentWidth: 1560,
  },
  square: {
    pad: 76,
    base: 38,
    displayJa: 172,
    headline: 76,
    title: 54,
    body: 38,
    caption: 34,
    gap: 30,
    stack: true,
    maxContentWidth: 928,
  },
};

export function fontStackSans(theme: VideoThemeTokens): string {
  return `"${theme.fontSans}", "Noto Sans JP", system-ui, -apple-system, sans-serif`;
}

/** Japanese glyphs come first so a CJK-capable face wins even when the Latin face happens to
 * ship partial kana coverage — mixed-font Japanese looks visibly broken. */
export function fontStackJa(theme: VideoThemeTokens): string {
  return `"${theme.fontJa}", "Hiragino Sans", "Yu Gothic", Meiryo, sans-serif`;
}

export function fontStackSerif(theme: VideoThemeTokens): string {
  return `"${theme.fontSerif}", Georgia, serif`;
}

/** Merges partial DB tokens over the default so a theme row can omit fields safely. */
export function resolveTheme(tokens?: Partial<VideoThemeTokens> | null): VideoThemeTokens {
  return { ...DEFAULT_THEME, ...(tokens ?? {}) };
}
