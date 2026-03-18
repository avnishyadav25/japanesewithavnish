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

export type ImageType = "product" | "blog" | "newsletter" | "page" | "learning" | "curriculum";

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
    default:
      return `A clean flat-vector educational image about "${topic}" for Japanese learners. Minimal study desk with hiragana, katakana, kanji elements.${BASE_STYLE}`;
  }
}
