/**
 * Font loading for scenes.
 *
 * Imported for its side effect by Root.tsx (render path) and by the admin Player wrapper, so
 * both load the same faces and the preview matches the output.
 *
 * `loadFont()` registers a delayRender() handle internally, which is what makes this safe under
 * headless rendering: Remotion will not screenshot a frame until the font has arrived, so no
 * frame is captured mid-swap with a fallback face.
 *
 * Weights are kept deliberately narrow. Google splits CJK faces into ~120 unicode-range slices,
 * so every extra Noto Sans JP weight costs another ~120 network requests per render process —
 * loading five weights produced 484 requests and a warning from Remotion, which is a real
 * flakiness risk on a CI runner. Two weights (regular + bold) cover every scene; JapaneseText
 * snaps any other requested weight onto one of them rather than letting the browser
 * synthesize a fake bold, which looks visibly wrong on kanji.
 *
 * If CI ever does start rate-limiting these, the next step is self-hosting the woff2 in
 * public/fonts/ and using staticFile() — one request, zero network variance. The system
 * fallbacks in theme.ts (Hiragino Sans, Yu Gothic, Meiryo, and fonts-noto-cjk on the Ubuntu
 * runner) mean a fetch failure degrades to a real CJK face instead of tofu boxes.
 */
import { loadFont as loadDmSans } from "@remotion/google-fonts/DMSans";
import { loadFont as loadDmSerif } from "@remotion/google-fonts/DMSerifDisplay";
import { loadFont as loadNotoJp } from "@remotion/google-fonts/NotoSansJP";

loadDmSans("normal", { weights: ["400", "500", "700"], subsets: ["latin"] });
loadDmSerif("normal", { weights: ["400"], subsets: ["latin"] });
loadNotoJp("normal", {
  weights: ["400", "700"],
  subsets: ["japanese", "latin"],
  ignoreTooManyRequestsWarning: true,
});

/** The only Japanese weights actually loaded. */
export const JA_WEIGHTS = [400, 700] as const;

/** Snaps an arbitrary weight onto a loaded Japanese face. */
export function nearestJaWeight(weight: number): 400 | 700 {
  return weight >= 600 ? 700 : 400;
}
