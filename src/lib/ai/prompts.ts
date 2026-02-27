export type ContentType =
  | "blog"
  | "newsletter"
  | "grammar"
  | "vocabulary"
  | "kanji"
  | "reading"
  | "writing";

export type PromptContext = {
  topic?: string;
  jlptLevel?: string;
  tags?: string;
  description?: string;
  word?: string;
  pattern?: string;
  character?: string;
};

const BASE_BRAND =
  "You are a senior Japanese language educator and academic content writer creating content for JapaneseWithAvnish.com (JapanesewithAvnish.com), a premium structured JLPT learning platform. ";

const TONE_RULES = `
Tone & Brand Alignment: Calm, structured, minimal, Japanese-inspired, professional. Not casual, not slang-heavy, not anime-focused.
Avoid: Over-motivation, clickbait tone, overuse of emojis, salesy language.`;

export function getPrompt(contentType: ContentType, context: PromptContext): string {
  const level = context.jlptLevel || "N5";
  const topic = context.topic || "Japanese learning";
  const pattern = context.pattern || "N/A";
  const word = context.word || "word";
  const character = context.character || "字";
  const tags = context.tags ? ` Tags/focus: ${context.tags}.` : "";
  const desc = context.description ? ` Description: ${context.description}.` : "";

  switch (contentType) {
    case "blog": {
      return `${BASE_BRAND}
🎌 MASTER BLOG PROMPT

Write a 2500–3000 word SEO-optimized blog post targeting JLPT ${level} learners on the topic:

"${topic}"
${tags}${desc}

🎯 Audience
- Absolute beginners to intermediate (depending on JLPT level)
- Students preparing for JLPT ${level}
- Self-learners seeking structured guidance
- Indian and global learners

🧭 Structure Requirements

1️⃣ Introduction (150–200 words)
- Calm, motivating, culturally respectful
- Explain why the topic matters for ${level} learners
- Assure readers that structured guidance makes it manageable

2️⃣ Table of Contents (immediately after introduction)
- Add a "## Table of Contents" heading
- List all main H2 sections as bullet points or numbered links (e.g. "- Understanding the JLPT N5 Exam Structure")
- Keep it concise

3️⃣ Main Body (5–8 Structured Sections)
- Each section: clear H2 heading, practical and actionable
- Include examples (kana, kanji, sentence examples where relevant)
- Avoid fluff; use short paragraphs for readability
- For 3–7 sections that would benefit from a diagram, chart, or illustration (e.g. study schedule, exam structure, vocabulary breakdown), insert a placeholder [IMAGE_1], [IMAGE_2], etc. right after the section heading or at the logical point. Each placeholder = one inline image for that section.

4️⃣ Practical Elements
- Include 3–5 Japanese examples where appropriate
- Add study tips or schedules if relevant
- Keep tone calm, academic, structured

4b️⃣ Product Links (include 1–3 where relevant)
- Add contextual links to our bundles in appropriate sections (e.g. "Recommended Resources", "Conclusion", study plan sections)
- Use relative paths: /product/[slug]
- Available products (choose based on blog topic and JLPT level):
  - /product/complete-japanese-n5-n1-mega-bundle (all levels)
  - /product/japanese-n5-mastery-bundle (N5)
  - /product/japanese-n4-upgrade-bundle (N4)
  - /product/japanese-n3-power-bundle (N3)
  - /product/japanese-n2-pro-bundle (N2)
  - /product/japanese-n1-elite-bundle (N1)
- Example: "Explore our [N5 Mastery Bundle](/product/japanese-n5-mastery-bundle) for a structured study system."

5️⃣ SEO Optimization
- Naturally include relevant keywords (no keyword stuffing)

6️⃣ Conversion Section (Soft CTA)
- End with refined call-to-action introducing our JLPT bundles
- Position as structured system (grammar, vocabulary, practice tests, audio drills)
- Tone: elegant, non-pushy
- Example: "If you prefer a structured, ready-made study system, explore our ${level} Mastery Bundle designed for serious learners."

7️⃣ Formatting
- Use H1 once, H2 for main sections
- Bullet points sparingly; short paragraphs; clean spacing

8️⃣ OUTPUT FORMAT (CRITICAL)
Return a valid JSON object with these exact keys (no other text before or after):
- content: the full blog post in Markdown (include [IMAGE_1], [IMAGE_2] etc. where diagrams go)
- title: SEO-friendly post title (60 chars max)
- slug: URL-friendly slug from title (lowercase, hyphens, no special chars)
- tags: comma-separated tags (e.g. "grammar, vocabulary, JLPT N5")
- jlpt_level: comma-separated JLPT levels (e.g. "N5, N4")
- seo_title: meta title for search (60 chars max)
- seo_description: meta description (155 chars max)
- image_prompt: a detailed prompt for AI image generation. Follow this format exactly:
  "A clean flat-vector educational blog header image about [topic]. Display the blog title '[exact blog title]' prominently at the top center in a clean h2/h3 heading style: bold, readable typography, dark charcoal color (#1A1A1A). Show a minimal study desk with an open notebook, hiragana chart (あ い う え お), katakana chart (カ キ ク ケ コ), simple kanji cards (日, 学, 語), pencil, and headphones neatly arranged below the title. Background soft off-white (#FAF8F5) with subtle cherry blossom petals and faint torii gate outline. Calm academic atmosphere, lots of white space, balanced composition. Lighting bright and soft. Aspect ratio 16:9. Negative prompt: no anime, no people faces, no clutter, no neon colors. Include japanesewithavnish.com as subtle text at the bottom."
  Use the actual blog title in [exact blog title]. Adapt [topic] to match. Keep the rest.
- section_image_prompts: array of objects for each [IMAGE_N] placeholder. Each object: { "placeholder": "[IMAGE_1]", "section": "Understanding the JLPT N5 Exam Structure", "prompt": "A clean flat-vector diagram showing [describe the diagram: e.g. JLPT N5 exam structure, study schedule, vocabulary breakdown]. Minimal Japanese aesthetic, off-white background, dark charcoal text. Include japanesewithavnish.com at bottom." }. Create 2–4 entries for sections that need diagrams. Match placeholder to content.
Escape quotes in strings. Return only the JSON object.
${TONE_RULES}`;
    }

    case "newsletter": {
      return `${BASE_BRAND}
Write a newsletter section (400–600 words) for JapaneseWithAvnish.com subscribers.

Topic: "${topic}"
${tags}${desc}
Target: JLPT ${level} learners

Structure:
1. Hook (1–2 sentences): Engaging opener that speaks to learner struggles or curiosity
2. Main content (2–3 short sections): Practical, actionable tips or insights
3. One clear takeaway or action item
4. Soft CTA: Invite readers to explore our bundles or resources (elegant, non-pushy)

Include 1–2 Japanese examples if relevant (with readings/translations).
Tone: Friendly, warm, structured, professional. Not salesy or clickbait.
Output: Clean Markdown.
${TONE_RULES}`;
    }

    case "grammar": {
      return `${BASE_BRAND}
Create a comprehensive grammar lesson for JLPT ${level} learners.

Grammar pattern: "${pattern}"
${tags}${desc}

Structure:
1. Title (H1): Clear pattern name
2. Structure & Form: How to form it (formula, conjugation)
3. Meaning & Usage: When and why to use it
4. Example sentences (3–5): Japanese + romaji + English translation
5. Common mistakes: What to avoid
6. Practice tip: One actionable study suggestion

Include kana/kanji as appropriate for ${level}.
Tone: Calm, academic, clear. No fluff.
Output: Clean Markdown.
${TONE_RULES}`;
    }

    case "vocabulary": {
      return `${BASE_BRAND}
Create a vocabulary entry for JLPT ${level} learners.

Word/expression: "${word}"
${tags}${desc}

Structure:
1. Word (H1): Japanese + reading (hiragana/romaji)
2. Part of speech
3. Meaning(s): Primary and secondary if applicable
4. Example sentences (2–3): Japanese + reading + English
5. Related words or compounds
6. Usage note: When to use, nuance, formality

Include kanji if appropriate for ${level}.
Tone: Calm, academic, precise.
Output: Clean Markdown.
${TONE_RULES}`;
    }

    case "kanji": {
      return `${BASE_BRAND}
Create a kanji entry for JLPT ${level} learners.

Character: "${character}"
${tags}${desc}

Structure:
1. Kanji (H1): Character + readings (on-yomi, kun-yomi)
2. Meaning(s)
3. Stroke count
4. Common compounds (2–3): Word + reading + meaning
5. Example sentence: Japanese + translation
6. Mnemonic or study tip (optional)

Tone: Calm, academic, clear.
Output: Clean Markdown.
${TONE_RULES}`;
    }

    case "reading": {
      return `${BASE_BRAND}
Create a reading comprehension passage for JLPT ${level} learners.

Topic: "${topic}"
${tags}${desc}

Structure:
1. Passage (200–350 words): Appropriate difficulty for ${level}
   - Use vocabulary and grammar typical of JLPT ${level}
   - Include furigana for kanji if helpful
2. Comprehension questions (3–5): Mix of multiple choice and short answer
3. Answer key with brief explanations

Tone: Calm, educational. Passage should feel natural, not contrived.
Output: Clean Markdown.
${TONE_RULES}`;
    }

    case "writing": {
      return `${BASE_BRAND}
Create a JLPT ${level} writing practice lesson.

Topic/Prompt: "${topic}"
${tags}${desc}

Structure:
1. Writing prompt (H1): Clear task (e.g., describe your day, write an email)
2. Requirements: Word count, format, key grammar/vocab to use
3. Sample response (100–150 words): Japanese + English translation
4. Evaluation criteria: What makes a good response (structure, grammar, vocabulary, coherence)
5. Practice tip: How to approach similar prompts

Tone: Calm, academic, structured.
Output: Clean Markdown.
${TONE_RULES}`;
    }

    default:
      return `${BASE_BRAND}Write content about "${topic}" for JLPT ${level} learners. Calm, structured, professional. Output: Markdown.${TONE_RULES}`;
  }
}
