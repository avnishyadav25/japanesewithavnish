export type ImageContext = {
  title?: string;
  jlptLevel?: string;
  topic?: string;
  tags?: string;
  description?: string;
  contentType?: string;
  /** For curriculum: "level" | "module" | "submodule" | "lesson" */
  entityType?: string;
};

export type ImageType = "product" | "blog" | "newsletter" | "page" | "learning" | "curriculum" | "mascot";

/** The cast, matching the Learn Hub illustrations so the video and the site read as one product. */
export const MASCOT_CHARACTERS = {
  fox: "a friendly red fox (kitsune) sensei wearing a deep indigo kimono with a subtle pattern, small round glasses",
  tanuki: "a cheerful tanuki (Japanese raccoon dog) student wearing a warm brown-and-cream yukata, a satchel over one shoulder",
  owl: "a wise owl professor wearing a charcoal haori jacket and half-moon spectacles",
  redPanda: "a bright-eyed red panda pupil wearing a soft rose-coloured kimono",
  // Added for the second cast. Each is a culturally-grounded Japanese animal rather than a
  // generic one, and each wears a distinct colour so two characters never read as the same
  // silhouette at the 180px the corner slot renders them at.
  cat: "a poised calico cat (maneki-neko lineage) wearing a moss-green haori with a small bell collar",
  shiba: "an eager shiba inu wearing a cream happi coat with a red sash, ears perked forward",
  crane: "an elegant red-crowned crane (tancho) wearing a pale blue kimono, long neck, serene expression",
  rabbit: "a soft white rabbit (tsuki no usagi) wearing a lilac yukata, long ears, gentle round eyes",
} as const;

export type MascotCharacter = keyof typeof MASCOT_CHARACTERS;

export const MASCOT_POSES = {
  wave: "standing, waving one paw in greeting, warm open smile, facing the viewer",
  point: "standing side-on, pointing upward and to its right with one paw, eyebrows raised, explaining something",
  think: "seated, one paw resting against its chin, eyes turned upward, thoughtful",
  write: "seated at a low desk seen from the side, holding a calligraphy brush, concentrating",
  celebrate: "both paws raised above its head in celebration, eyes closed happily, mid-hop",
  // Read at a glance in a 180px corner slot, which is why each is a whole-body silhouette
  // change rather than a facial expression.
  bow: "bowing forward from the waist, both paws at its sides, eyes closed respectfully",
  read: "seated cross-legged holding an open book with both paws, absorbed",
  // --- the teaching set (roadmap 6.3) --------------------------------------------------------
  // A teacher needs more than a greeting and a wave. These are the gestures a long-form lesson
  // actually calls for, and each is a whole-body silhouette change for the same reason as above:
  // at the 180px a corner slot renders, a change of expression alone is invisible.
  explain: "standing, both paws open and turned upward at chest height, mid-sentence, explaining patiently",
  pointLeft: "standing side-on facing left, one paw extended pointing to its left at something off to the side, attentive",
  pointDown: "standing, one paw angled downward-forward indicating something below it, head tilted to follow the gesture",
  encourage: "standing, one paw raised with a thumbs-up gesture, eyes bright, encouraging",
  surprise: "standing upright, both paws raised near its cheeks, eyes wide, mouth open in delighted surprise",
  correct: "standing, one paw raised palm-outward in a gentle stop gesture, brows drawn slightly, correcting kindly",
} as const;

export type MascotPose = keyof typeof MASCOT_POSES;

/**
 * The chroma field mascots are generated on.
 *
 * Neither Gemini 2.5 Flash Image nor Z-Image reliably emits a real alpha channel from a text
 * prompt, so transparency is produced afterwards by keying this colour out with sharp. Pure
 * magenta is chosen because it appears nowhere in the brand palette or in any plausible fur,
 * kimono or brush-ink colour — keying out white or green would eat parts of the character.
 */
export const MASCOT_CHROMA = { r: 255, g: 0, b: 255, hex: "#FF00FF" } as const;

const BASE_STYLE = `
Style: flat vector illustration, minimal Japanese aesthetic.
Background soft off-white (#FAF8F5) with subtle cherry blossom petals and faint torii gate outline.
Calm academic atmosphere, lots of white space, balanced composition.
Lighting bright and soft.
Aspect ratio 16:9.
Negative prompt: no anime, no people faces, no clutter, no neon colors.
Include "japanesewithavnish.com" as subtle text at the bottom.`;

export function getImagePrompt(imageType: ImageType, context: ImageContext): string {
  const level = context.jlptLevel || "N5";
  const topic = context.topic || context.title || "Japanese learning";
  const tags = context.tags ? ` Tags: ${context.tags}.` : "";
  const desc = context.description ? ` ${context.description}.` : "";
  const contentType = context.contentType || "lesson";

  switch (imageType) {
    case "blog": {
      const titleText = context.title || topic;
      return `A clean flat-vector educational blog header image about "${topic}" for JLPT ${level} learners.${tags}${desc}
Display the blog title "${titleText}" prominently at the top center in a clean h2/h3 heading style: bold, readable typography, dark charcoal color (#1A1A1A).
Show a minimal study desk with an open notebook, hiragana chart (あ い う え お), katakana chart (カ キ ク ケ コ), simple kanji cards (日, 学, 語), pencil, and headphones neatly arranged below the title.
${BASE_STYLE}`;
    }
    case "product": {
      const productTitle = context.title || `${topic} – JLPT ${level} Mastery Bundle`;
      return `A clean flat-vector educational product/bundle cover image for "${topic}" – JLPT ${level} Mastery Bundle.${tags}${desc}
Display the product title "${productTitle}" prominently at the top center in a clean h2/h3 heading style: bold, readable typography, dark charcoal color (#1A1A1A).
Show a minimal study desk with an open notebook, hiragana chart (あ い う え お), katakana chart (カ キ ク ケ コ), simple kanji cards (日, 学, 語), pencil, and headphones neatly arranged below. Add crimson red accent for premium feel.
${BASE_STYLE}`;
    }
    case "newsletter": {
      const newsletterTitle = context.title || topic;
      return `A clean flat-vector educational newsletter banner image about "${topic}" for Japanese learners.${tags}${desc}
Display the title "${newsletterTitle}" prominently at the top center in a clean h2/h3 heading style: bold, readable typography, dark charcoal color (#1A1A1A).
Show a minimal study desk with an open notebook, hiragana chart (あ い う え お), katakana chart (カ キ ク ケ コ), simple kanji cards (日, 学, 語), pencil, and headphones neatly arranged below. Soft gold and crimson accents, welcoming.
${BASE_STYLE}`;
    }
    case "page": {
      const pageTitle = context.title || topic;
      return `A clean flat-vector educational landing page hero image about "${topic}".${tags}${desc}
Display the title "${pageTitle}" prominently at the top center in a clean h2/h3 heading style: bold, readable typography, dark charcoal color (#1A1A1A).
Show a minimal study desk with an open notebook, hiragana chart (あ い う え お), katakana chart (カ キ ク ケ コ), simple kanji cards (日, 学, 語), pencil, and headphones neatly arranged below. Premium feel, Japanese culture inspired.
${BASE_STYLE}`;
    }
    case "learning": {
      const learningTitle = context.title || `${contentType}: ${topic}`;
      return `A clean flat-vector educational illustration for ${contentType} lesson about "${topic}", JLPT ${level}.${tags}${desc}
Display the lesson title "${learningTitle}" prominently at the top center in a clean h2/h3 heading style: bold, readable typography, dark charcoal color (#1A1A1A).
Show a minimal study desk with an open notebook, hiragana chart (あ い う え お), katakana chart (カ キ ク ケ コ), simple kanji cards (日, 学, 語), pencil, and headphones neatly arranged below. Clear and simple.
${BASE_STYLE}`;
    }
    case "curriculum": {
      const entityType = context.entityType || "lesson";
      const heading = context.title || context.topic || "Japanese with Avnish";
      return `A clean flat-vector educational curriculum feature image for ${entityType}: "${heading}". JLPT ${level}.${tags}${desc}
Display the heading "${heading}" prominently at the top center in a clean h2/h3 heading style: bold, readable typography, dark charcoal color (#1A1A1A).
Show a minimal study desk with an open notebook, hiragana chart (あ い う え お), katakana chart (カ キ ク ケ コ), simple kanji cards (日, 学, 語), pencil, and headphones neatly arranged below. Calm academic atmosphere.
${BASE_STYLE}
At the bottom of the image, display the text japanesewithavnish.com in clean, readable typography (subtle but legible).`;
    }
    case "mascot":
      // Handled by getMascotPrompt(), which needs a character and pose rather than an
      // ImageContext. Routed here only so the ImageType union stays exhaustive.
      return getMascotPrompt("fox", "wave");
    default:
      return `A clean flat-vector educational image about "${topic}" for Japanese learners. Minimal study desk with hiragana, katakana, kanji elements.${BASE_STYLE}`;
  }
}

/**
 * Prompt for one mascot cutout.
 *
 * Deliberately does NOT use BASE_STYLE, which is actively hostile to this job on three counts:
 * it negative-prompts "no anime, no people faces" (these are stylised characters), it forces a
 * #FAF8F5 background (we need a keyable chroma field), and it bakes "japanesewithavnish.com" into
 * the image (a watermark inside a mascot cutout would float in mid-air over the video).
 *
 * The style brief matches public/images/hub/*.jpg — ukiyo-e-influenced storybook line art with
 * flat colour — so a mascot standing on a video frame looks like it came from the same hand as
 * the Learn Hub artwork.
 */
export function getMascotPrompt(character: MascotCharacter, pose: MascotPose): string {
  return `A single full-body character illustration: ${MASCOT_CHARACTERS[character]}, ${MASCOT_POSES[pose]}.

Style: Japanese storybook illustration with ukiyo-e influence — confident dark ink linework, flat
colour fill, subtle cel shading, no gradients or photographic texture. Warm, friendly, suitable for
a language-learning audience of all ages.

CRITICAL COMPOSITION REQUIREMENTS:
- Solid, perfectly uniform ${MASCOT_CHROMA.hex} magenta background. Absolutely flat — no gradient,
  no vignette, no shadow cast onto the background, no texture, no border or frame.
- The character must not touch the edges of the image. Leave clear magenta margin on all four sides.
- Exactly ONE character. No scenery, no furniture, no props beyond what the pose names, no ground
  plane, no cast shadow, no decorative elements.
- No text, no lettering, no logos, no watermark, no signature anywhere in the image.
- Crisp, clean edges on the character silhouette so it can be cut out cleanly.

Aspect ratio 1:1.
Negative prompt: background scenery, gradient background, drop shadow, text, watermark, frame,
border, multiple characters, photorealism, 3D render, blurry edges, cropped limbs.`;
}
