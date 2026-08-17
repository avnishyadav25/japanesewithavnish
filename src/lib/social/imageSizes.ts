/**
 * The image sizes that change whether anyone clicks.
 *
 * Not every surface: most already ship a video, and an unused image on a Reel is dead weight.
 * These five are the ones where the picture IS the click decision — a YouTube thumbnail, an
 * Instagram feed post, a Pinterest pin (Pinterest is a search engine; pins are read), and the
 * og:image that every share of a blog post renders.
 *
 * Dimensions are each platform's own recommendation, not derived from the aspect ratio strings in
 * PLATFORM_RULES — "16:9" does not tell you whether to render 1280x720 or 1920x1080, and uploading
 * the wrong absolute size gets re-encoded.
 *
 * Isomorphic on purpose: the browser composites these and a server route stores them, so this
 * module imports nothing.
 */
export interface ImageSize {
  key: string;
  label: string;
  width: number;
  height: number;
  /** Surfaces this image is stored against. `blog` also becomes the post's og:image. */
  surfaces: string[];
  /** Why this size exists, shown in the UI so nobody wonders. */
  note: string;
}

export const SOCIAL_IMAGE_SIZES: ImageSize[] = [
  {
    key: "youtube_thumb",
    label: "YouTube thumbnail",
    width: 1280,
    height: 720,
    surfaces: ["youtube.long", "youtube.short"],
    note: "The single biggest lever on YouTube click-through. Readable at phone size or not at all.",
  },
  {
    key: "instagram_square",
    label: "Instagram square",
    width: 1080,
    height: 1080,
    surfaces: ["instagram.post"],
    note: "The feed default.",
  },
  {
    key: "instagram_portrait",
    label: "Instagram portrait",
    width: 1080,
    height: 1350,
    surfaces: ["instagram.post", "instagram.carousel"],
    note: "4:5 takes more vertical space in the feed than 1:1, so it is usually the better choice.",
  },
  {
    key: "pinterest_pin",
    label: "Pinterest pin",
    width: 1000,
    height: 1500,
    surfaces: ["pinterest.pin"],
    note: "2:3 is what Pinterest ranks. Text has to carry it — pins surface in search for years.",
  },
  {
    key: "og_image",
    label: "Blog / link preview",
    width: 1200,
    height: 630,
    surfaces: ["blog.article", "x.post", "facebook.post", "linkedin.post"],
    note: "The og:image every share renders. Also set as the post's feature image when the brief came from one.",
  },
];

export function sizeByKey(key: string): ImageSize | undefined {
  return SOCIAL_IMAGE_SIZES.find((s) => s.key === key);
}

/**
 * The background prompt.
 *
 * THREE RULES, all learned by looking at what came back.
 *
 * 1. Ask for a SCENE, never a diagram. The first version passed the lesson topic through as-is —
 *    "arimasu vs imasu, existence verbs" — and got a comparison layout with the words ARIMASU and
 *    IMASU rendered into the picture, despite five separate instructions not to draw text. A topic
 *    that reads like a teaching diagram gets drawn as one. Describing an everyday scene the topic
 *    evokes removes the temptation entirely.
 * 2. Forbid text explicitly anyway, including the words that invite it: labels, captions,
 *    diagrams, comparisons, arrows. Belt and braces, because the model still slips occasionally
 *    and a headline is composited over this afterwards.
 * 3. Ask for empty space where the headline goes, or the subject lands underneath it.
 */
export function backgroundPrompt(params: {
  topic: string;
  jlptLevel?: string | null;
  contentType?: string | null;
  /** Which third stays clear, matching where the composite puts the headline. */
  textSide?: "left" | "right" | "bottom";
}): string {
  const side = params.textSide ?? "left";
  const subject = params.topic.trim() || "Japanese language learning";

  return [
    "A single calm everyday scene, flat vector illustration, minimal Japanese aesthetic.",
    "Soft off-white background (#FAF8F5), subtle cherry blossom petals, warm muted palette,",
    "bright soft lighting, generous negative space.",
    "",
    // "Inspired by" rather than "illustrating": the latter produces a teaching diagram.
    `Draw an ordinary scene inspired by this lesson, NOT an explanation of it: ${subject}.`,
    "Think of a still life or a quiet room — objects, an animal, a place. One subject only.",
    params.jlptLevel ? `The audience is an early-stage learner (${params.jlptLevel}).` : "",
    "",
    `COMPOSITION: keep the ${side} third of the frame almost empty — a headline goes there.`,
    "Place the single subject in the opposite third. Square framing.",
    // Without this it draws a small framed vignette floating in dead margins — the composite then
    // crops mostly empty paper. "Edge to edge" is what fixes it.
    "Fill the entire canvas edge to edge. No borders, no inner frame, no floating panel, no",
    "vignette, no drop shadow around the artwork.",
    "",
    "STRICTLY NO TEXT OF ANY KIND. No letters, words, kanji, kana, numbers, captions, labels,",
    "watermarks or signage. NOT a diagram, NOT a comparison, NOT a chart, no arrows, no split",
    "panels, no before-and-after. A picture only.",
    "No anime style, no human faces, no clutter, no neon colours.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * How the background is placed in a target size.
 *
 * Gemini returns a square whatever aspect ratio the prompt asks for. Centre-cropping that to
 * 1280x720 cuts the top and bottom off and destroys the composition — measured by looking at one.
 *
 * So wide formats put the square image in a panel on one side and the headline on flat brand
 * colour beside it: no crop damage, and guaranteed contrast without a scrim. Near-square and
 * portrait targets are close enough to the source that cover-fitting is fine.
 */
export function backgroundFit(size: ImageSize): "panel" | "cover" {
  return size.width / size.height > 1.3 ? "panel" : "cover";
}
