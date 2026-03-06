export type ContentType =
  | "blog"
  | "newsletter"
  | "carousel"
  | "grammar"
  | "vocabulary"
  | "kanji"
  | "reading"
  | "listening"
  | "writing"
  | "sounds"
  | "study_guide"
  | "practice_test"
  | "product";

export type PromptContext = {
  topic?: string;
  jlptLevel?: string;
  tags?: string;
  description?: string;
  word?: string;
  pattern?: string;
  character?: string;
  /** Grammar/word meaning (pulled from form meta). */
  meaning?: string;
  /** Grammar structure e.g. [SUBJECT] は [NOUN] です (pulled from form meta). */
  structure?: string;
  /** For list generation: number of items to generate (e.g. 80 for N5 vocab). */
  listCount?: number;
  /** Existing slugs already in DB; AI should generate only NEW items not in this list. */
  existingSlugs?: string[];
};

const BASE_BRAND =
  "You are a senior Japanese language educator and academic content writer creating content for JapaneseWithAvnish.com (JapanesewithAvnish.com), a premium structured JLPT learning platform. ";

const TONE_RULES = `
Tone & Brand Alignment: Calm, structured, minimal, Japanese-inspired, professional. Not casual, not slang-heavy, not anime-focused.
Avoid: Over-motivation, clickbait tone, overuse of emojis, salesy language.`;

const TERM_LESSON_STYLE_RULES = `
Global rules:
- You are teaching beginners preparing for JLPT N5–N1 (use the provided JLPT level).
- Keep explanations simple and practical. Avoid heavy linguistics jargon.
- Use calm academic tone (no hype).
- Prefer short paragraphs and clean formatting.
- Do NOT use emojis except for the two dialogue character markers (Sakura 🌸, Kenji 🐼).

Japanese formatting rules:
- For each Japanese line, provide romaji and English on the next lines.
- Use natural Japanese appropriate for the JLPT level.

Image prompt style rules (for Nano Banana / Midjourney / DALL·E):
- Style: friendly educational flat-vector (NOT anime), minimal Japanese classroom aesthetic.
- Background: off-white (#FAF8F5). Accent: red (#D0021B). Text: dark charcoal (#1A1A1A).
- Clean composition, lots of white space, readable typography.
- Negative prompt (apply to all): no clutter, no neon, no photorealism, no anime exaggeration, no scary faces.
- Default aspect ratio: 1:1 unless specified.
- If the prompt includes on-image text, ensure it is short and highly legible.`;

export function getPrompt(contentType: ContentType, context: PromptContext): string {
  const level = context.jlptLevel || "N5";
  const topic = context.topic || "Japanese learning";
  const pattern = context.pattern || "N/A";
  const word = context.word || "word";
  const character = context.character || "字";
  const meaning = context.meaning || "";
  const structure = context.structure || "";
  const tags = context.tags ? ` Tags/focus: ${context.tags}.` : "";
  const desc = context.description ? ` Description: ${context.description}.` : "";
  const grammarExtra =
    meaning || structure
      ? `\nMeaning: ${meaning || "—"}.${structure ? `\nStructure: ${structure}.` : ""}\n`
      : "";

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

    case "carousel": {
      const input =
        pattern !== "N/A"
          ? pattern
          : word !== "word"
            ? word
            : character !== "字"
              ? character
              : topic;
      return `${BASE_BRAND}
🎌 INSTAGRAM CAROUSEL GENERATOR (10 SLIDES)

You are a Japanese language teacher and content creator. Generate a complete Instagram carousel teaching ONE Japanese concept.

INPUT_TERM: "${input}"
JLPT_LEVEL: ${level}
${grammarExtra}${tags}${desc}

Audience:
- Beginners and JLPT ${level} learners
- Self-learners

Tone:
- calm, clear, educational
- simple English
- not anime-focused, not hype

Brand visual style (for ALL image prompts):
- Off-white background (#FAF8F5)
- Red accents (#D0021B)
- Flat vector educational illustration
- Minimal Japanese classroom aesthetic
- Clean readable typography (dark charcoal #1A1A1A)
- Aspect ratio: 1:1
- At the bottom of the image, display the text "japanesewithavnish.com" in subtle, readable typography.

Slide structure (exactly 10 slides):
1) Hook & term (hero)
2) Meaning (JP + romaji + EN)
3) Simple structure / how to use
4) Mnemonic / memory trick
5) Example 1 (JP + romaji + EN)
6) Example 2 (JP + romaji + EN)
7) Example 3 (JP + romaji + EN)
8) Example 4 (JP + romaji + EN)
9) Quick quiz (with options A/B/C + answer)
10) Study tip + CTA (follow / save / practice)

OUTPUT FORMAT (no extra text before/after):
Slide 1
Title:
Text:
Image Prompt:

Slide 2
Title:
Text:
Image Prompt:

... continue through Slide 10.

Rules:
- Keep each slide Text short (2–3 lines, max ~180 characters).
- Include Japanese + romaji + English for meaning and examples (as space allows).
- Each Image Prompt must be 2–3 sentences describing the exact scene and the on-image text to include (term + key line). Include the brand visual style. End with the site text rule.
${TONE_RULES}`.trim();
    }

    case "grammar": {
      return `${BASE_BRAND}
🎌 UNIVERSAL TERM LESSON (Grammar) — JLPT ${level}

You are a Japanese language teacher helping beginners preparing for JLPT N5–N3.
Create structured learning content for this grammar pattern:

INPUT_TERM: "${pattern}"
${grammarExtra}${tags}${desc}

OUTPUT FORMAT (CRITICAL):
Return ONLY valid JSON. No markdown fences, no commentary, no trailing commas.
{
  "content": "Markdown lesson content (string)",
  "feature_image_prompt": "string (best hero image prompt for this lesson)",
  "image_prompt_items": [
    { "placeholder": "[IMG_MEANING_CARD]", "role": "Meaning card", "aspect_ratio": "1:1", "prompt": "..." }
  ]
}

In the content, include these placeholders on their own line where the images should be inserted:
[IMG_MEANING_CARD]
[IMG_MNEMONIC]
[IMG_EX_1] [IMG_EX_2] [IMG_EX_3] [IMG_EX_4] (and optionally [IMG_EX_5], [IMG_EX_6])
[IMG_CONVO]
[IMG_QUIZ]
[IMG_STUDY_TIP]

Your lesson content MUST include these sections (use the exact headings):

## Meaning
- Japanese: (the pattern)
- Romaji:
- Meaning (simple English):
- When you use it (1 sentence):

## Simple Explanation
- Explain how it works in very simple terms.
- Give 1–2 core structures using slots like: [Person] は [Thing] を …
- If conjugation is needed, show the ONE most important rule (keep it short).

## Mnemonic / Memory Trick
- Create a visual or story-based memory trick.

## Example Sentences (4–6)
- Each example MUST be exactly 3 lines:
Japanese:
Romaji:
English:
- Keep sentences beginner-friendly and realistic.

## Mini Conversation (Cartoon Style)
- Two characters only:
Sakura 🌸
Kenji 🐼
- 4–6 turns total.
- For each turn: Japanese line, then romaji, then English.

## Common Beginner Mistake
- Show one common mistake with:
❌ Incorrect (Japanese)
✔ Correct (Japanese)
- Explain the mistake in 1–2 simple sentences.

## Practice Exercise
- Provide 2–3 short questions.
- Include at least ONE multiple-choice fill-in-the-blank with:
Question, Options (A/B/C), Correct answer, Explanation.

## Study Tip
- One daily practice tip (1–2 sentences).

Image prompt requirements (for feature_image_prompt and every image_prompt_items.prompt):
- Include the exact on-image text to show (term + 1 key line).
- Follow these style rules:
${TERM_LESSON_STYLE_RULES}
${TONE_RULES}`.trim();
    }

    case "vocabulary": {
      return `${BASE_BRAND}
🎌 UNIVERSAL TERM LESSON (Vocabulary) — JLPT ${level}

You are a Japanese language teacher helping beginners preparing for JLPT N5–N3.
Create structured learning content for this vocabulary word/expression:

INPUT_TERM: "${word}"
${meaning ? `Known meaning (from meta): ${meaning}.\n` : ""}${tags}${desc}

OUTPUT FORMAT (CRITICAL):
Return ONLY valid JSON. No markdown fences, no commentary, no trailing commas.
{
  "content": "Markdown lesson content (string)",
  "feature_image_prompt": "string (best hero image prompt for this lesson)",
  "image_prompt_items": [
    { "placeholder": "[IMG_MEANING_CARD]", "role": "Meaning card", "aspect_ratio": "1:1", "prompt": "..." }
  ]
}

In the content, include these placeholders on their own line where the images should be inserted:
[IMG_MEANING_CARD]
[IMG_MNEMONIC]
[IMG_EX_1] [IMG_EX_2] [IMG_EX_3] [IMG_EX_4] (and optionally [IMG_EX_5], [IMG_EX_6])
[IMG_CONVO]
[IMG_QUIZ]
[IMG_STUDY_TIP]

Your lesson content MUST include these sections (use the exact headings):

## Meaning
Japanese:
Romaji:
Meaning:
Part of speech:
Nuance / when to use (1 sentence):

## Simple Explanation
- Explain how the word is used.
- Give 1 simple pattern (slot form) showing common particles.
- Mention politeness if relevant (ます-form vs dictionary form) in 1 sentence.

## Mnemonic / Memory Trick
- Visual or story-based.
- If the word has kanji, optionally reference the kanji shape/components (keep it simple).

## Example Sentences (4–6)
- Each example MUST be exactly 3 lines:
Japanese:
Romaji:
English:
- Make the examples varied (time words, objects, places) but still beginner level.

## Mini Conversation (Cartoon Style)
- Two characters only:
Sakura 🌸
Kenji 🐼
- 4–6 turns total.
- For each turn: Japanese line, then romaji, then English.

## Common Beginner Mistake
- One common mistake (particle, missing を/が, wrong formality, wrong tense).
- Show:
❌ Incorrect (Japanese)
✔ Correct (Japanese)
- Explain in 1–2 sentences.

## Practice Exercise
- 2–3 tasks.
- Include at least ONE multiple-choice fill-in-the-blank (A/B/C) + correct answer + explanation.

## Study Tip
- One daily practice tip (1–2 sentences).

Image prompt requirements (for feature_image_prompt and every image_prompt_items.prompt):
- Include the exact on-image text to show (term + 1 key line).
- Follow these style rules:
${TERM_LESSON_STYLE_RULES}
${TONE_RULES}`.trim();
    }

    case "kanji": {
      return `${BASE_BRAND}
🎌 UNIVERSAL TERM LESSON (Kanji) — JLPT ${level}

You are a Japanese language teacher helping beginners preparing for JLPT N5–N3.
Create structured learning content for this kanji:

INPUT_TERM: "${character}"
${meaning ? `Known meaning (from meta): ${meaning}.\n` : ""}${tags}${desc}

OUTPUT FORMAT (CRITICAL):
Return ONLY valid JSON. No markdown fences, no commentary, no trailing commas.
{
  "content": "Markdown lesson content (string)",
  "feature_image_prompt": "string (best hero image prompt for this lesson)",
  "image_prompt_items": [
    { "placeholder": "[IMG_MEANING_CARD]", "role": "Meaning card", "aspect_ratio": "1:1", "prompt": "..." }
  ]
}

In the content, include these placeholders on their own line where the images should be inserted:
[IMG_MEANING_CARD]
[IMG_MNEMONIC]
[IMG_COMPOUNDS_GRID]
[IMG_EX_1] [IMG_EX_2] [IMG_EX_3] [IMG_EX_4] (and optionally [IMG_EX_5], [IMG_EX_6])
[IMG_CONVO]
[IMG_QUIZ]
[IMG_STUDY_TIP]

Your lesson content MUST include these sections (use the exact headings):

## Meaning
Kanji:
Romaji (main reading):
Meaning:
On-yomi (if common for this level):
Kun-yomi (if common for this level):
Stroke count (best estimate):

## Simple Explanation
- Explain what the kanji means and where you commonly see it.
- Give 2–4 very common compounds/words using this kanji (word + reading + meaning).

## Mnemonic / Memory Trick
- A visual story based on the kanji shape/components.

## Example Sentences (4–6)
- Use words that contain this kanji when possible.
- Each example MUST be exactly 3 lines:
Japanese:
Romaji:
English:

## Mini Conversation (Cartoon Style)
- Two characters only:
Sakura 🌸
Kenji 🐼
- 4–6 turns total.
- Use at least one word containing the kanji.
- For each turn: Japanese line, then romaji, then English.

## Common Beginner Mistake
- One mistake: wrong reading, confusing with a similar kanji, or using the wrong compound.
- Show:
❌ Incorrect (Japanese)
✔ Correct (Japanese)
- Explain in 1–2 sentences.

## Practice Exercise
- 2–3 tasks. Include at least ONE task like:
  - choose the correct reading
  - pick the correct compound meaning
  - fill-in-the-blank with the right kanji word
- Include at least ONE multiple-choice question (A/B/C) + correct answer + explanation.

## Study Tip
- One daily practice tip (1–2 sentences).

Image prompt requirements (for feature_image_prompt and every image_prompt_items.prompt):
- Include the exact on-image text to show (kanji + 1 key line).
- Follow these style rules:
${TERM_LESSON_STYLE_RULES}
${TONE_RULES}`.trim();
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

    case "listening": {
      return `${BASE_BRAND}
Create a JLPT ${level} listening comprehension practice lesson.

Topic: "${topic}"
${tags}${desc}

Structure:
1. Scene/Context (H1): Describe the listening scenario (e.g., at a station, in a restaurant, a phone call)
2. Dialogue or Monologue (Japanese text, 100–180 words): Natural-sounding, appropriate for ${level}
   - Include furigana for kanji above N5 level
3. Comprehension questions (3–4): Multiple choice or short answer
4. Answer key with brief explanations
5. Vocabulary spotlight: 3–5 key words from the passage (word + reading + meaning)
6. Listening tip: One practice strategy for ${level} listening sections

Tone: Calm, educational. Dialogue should feel natural and contextually appropriate.
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

    case "sounds": {
      return `${BASE_BRAND}
Create a kana/pronunciation (sounds) lesson for JLPT ${level} learners.

Topic: "${topic}"
${tags}${desc}

Structure:
1. Title (H1): e.g. "Hiragana あ-row" or "Katakana カ-row"
2. Introduction: Why this set matters, how to pronounce
3. Table or list: Each character with romaji, optional mnemonic, and a short example word
4. Pronunciation tips: Common mistakes, mouth position
5. Practice: 2–3 words or phrases using these characters (Japanese + romaji + meaning)

If describing a character set, use clear headings. You can suggest a meta structure: columns (e.g. a-i-u-e-o), characters (char, romaji, mnemonic). Tone: Calm, educational.
Output: Clean Markdown.
${TONE_RULES}`;
    }

    case "study_guide": {
      return `${BASE_BRAND}
Create a JLPT study guide section for "${topic}" (JLPT ${level}).

${tags}${desc}

Structure:
1. Title (H1): e.g. "How to pass JLPT ${level}" or "JLPT ${level} study plan"
2. Overview: Exam structure, sections, time, scoring (concise)
3. Sections (3–5 H2s): e.g. Vocabulary strategy, Grammar strategy, Reading, Listening, Time management
4. Study schedule: Weekly or monthly breakdown (realistic)
5. Resources: What to use (books, mock tests, our bundles) — use relative links like /product/japanese-n5-mastery-bundle where relevant
6. Final tips: Test-day advice, common pitfalls

Tone: Calm, authoritative, actionable. No fluff.
Output: Clean Markdown.
${TONE_RULES}`;
    }

    case "practice_test": {
      return `${BASE_BRAND}
Create a practice test description and instructions for JLPT ${level} learners.

Topic: "${topic}"
${tags}${desc}

Structure:
1. Title (H1): e.g. "JLPT ${level} Mock Test 1" or "Practice test: Vocabulary & Grammar"
2. Overview: What this test covers (sections, question types, duration)
3. How to use: Instructions (e.g. use PDF + audio, timing, self-scoring)
4. Sections: List each section (Language Knowledge, Reading, Listening) with time and question count
5. Answer key: Where to find answers or how to self-check
6. Tips: How to simulate exam conditions

Tone: Calm, clear, practical. No fluff.
Output: Clean Markdown.
${TONE_RULES}`;
    }

    case "product": {
      return `${BASE_BRAND}
Generate complete product copy for a JLPT ${level} learning bundle.

Product name: "${topic}"
${tags}${desc}

Write premium, conversion-focused product copy for a Japanese learning digital bundle. Tone: calm, structured, professional, premium — not salesy or hype-driven.

OUTPUT FORMAT (return ONLY valid JSON, no other text):
{
  "description": "2–3 sentence marketing description. Clear value proposition. Who it's for + what they get + outcome. 60–80 words.",
  "who_its_for": "3 short bullet points (one per line, no bullet symbols) describing the ideal learner. E.g.:\\nStudents preparing for JLPT ${level} exam\\nSelf-learners wanting structured offline study material\\nLearners who want to study without internet dependency",
  "outcome": "1–2 sentences. What the learner will be able to do after completing this bundle. Specific, measurable, motivating. E.g.: 'Complete JLPT ${level} preparation with 800+ vocabulary words, essential grammar patterns, and 5 full-length mock tests.'",
  "whats_included": ["Item 1 with quantity/detail", "Item 2 with quantity/detail", "Item 3", "Item 4", "Item 5", "Item 6"],
  "faq": [
    {"q": "How do I access the content after purchase?", "a": "You will receive an email with a magic link to your personal library where all downloads are available."},
    {"q": "Can I study offline?", "a": "Yes, all PDFs and audio files can be downloaded to your device for offline study."},
    {"q": "Is this suitable for complete beginners?", "a": "Provide an honest JLPT-level-appropriate answer here."},
    {"q": "How long will it take to complete?", "a": "Provide a realistic time estimate based on the JLPT level and bundle contents."}
  ],
  "no_refunds_note": "All digital purchases are final. No refunds once content is accessed.",
  "image_prompt": "A clean flat-vector product banner image for the '${topic}' JLPT ${level} Japanese learning bundle. Display the product name '${topic}' prominently at the top in bold, dark charcoal typography. Show an elegant study desk with: a structured Japanese study workbook open to a vocabulary/grammar page (hiragana/katakana/kanji visible), audio headphones, pencil, JLPT ${level} flashcards neatly arranged. Background: soft off-white #FAF8F5 with subtle cherry blossom petals and faint torii gate silhouette. Red (#D0021B) accent line or seal in corner. Calm academic atmosphere, premium quality. 16:9 aspect ratio. Include 'japanesewithavnish.com' as subtle footer text. No anime, no people faces, no clutter."
}

Return only the JSON. No markdown fences. No extra explanation.
${TONE_RULES}`;
    }

    default:
      return `${BASE_BRAND}Write content about "${topic}" for JLPT ${level} learners. Calm, structured, professional. Output: Markdown.${TONE_RULES}`;
  }
}

/** Prompt to generate a list of learning items (for bulk creation). Output must be a JSON array. */
export function getListPrompt(contentType: ContentType, context: PromptContext): string {
  const level = context.jlptLevel || "N5";
  const topic = context.topic || "";
  const count = Math.min(Math.max(Number(context.listCount) || 20, 5), 200);
  const scope = topic ? `Scope: ${topic}.` : "";
  const existingSlugs = context.existingSlugs?.filter(Boolean) ?? [];
  const existingLine =
    existingSlugs.length > 0
      ? `\n\nIMPORTANT: The following slugs already exist. Generate ONLY NEW items whose slug is NOT in this list (do not duplicate): [${existingSlugs.slice(0, 100).map((s) => `"${String(s).replace(/"/g, '\\"')}"`).join(", ")}]${existingSlugs.length > 100 ? ` ... and ${existingSlugs.length - 100} more` : ""}.`
      : "";

  const listInstructions = `
OUTPUT FORMAT: Return ONLY a valid JSON array. No markdown code fences, no text before or after.
Each element must be an object with at least: title (string), slug (URL-safe, lowercase, hyphens).
Add type-specific meta fields where noted so we can prefill admin forms.${existingLine}`;

  switch (contentType) {
    case "grammar":
      return `${BASE_BRAND}
Generate a list of ${count} JLPT ${level} grammar points to create as separate lessons. ${scope}
${listInstructions}
Each item must use this exact structure. Include 8-12 different example sentences per grammar point in meta.examples. Include meta.image_prompt (one short sentence describing a card/list image for this lesson) and optional meta.summary.
{ "title": "Grammar pattern name", "slug": "url-slug", "meta": { "grammar_form": "日本語", "reading": "romaji", "meaning": "brief meaning", "structure": "optional pattern e.g. [SUBJECT] は [NOUN] です", "summary": "one line for cards", "image_prompt": "e.g. Flat illustration for grammar pattern X, JLPT N5", "examples": [ { "japanese": "full sentence in Japanese", "romaji": "romaji reading", "translation": "English translation" }, ... 8 to 12 examples ] } }.`;

    case "vocabulary":
      return `${BASE_BRAND}
Generate a list of ${count} JLPT ${level} vocabulary words/expressions to create as separate lessons. ${scope}
${listInstructions}
Each item must include 8-12 example sentences in meta.examples. Use japanese (kanji/hiragana/katakana), reading (romaji), meaning (English), and type. Optional: summary, image_prompt.
{ "title": "Word or phrase", "slug": "url-slug", "meta": { "japanese": "日本語 or ひらがな", "reading": "romaji", "type": "Noun|Verb|etc", "meaning": "English meaning", "summary": "one line for cards", "image_prompt": "optional card image description", "examples": [ { "japanese": "sentence in Japanese", "romaji": "romaji", "translation": "English" }, ... 8 to 12 examples ] } }.`;

    case "kanji":
      return `${BASE_BRAND}
Generate a list of ${count} JLPT ${level} kanji to create as separate lessons. ${scope}
${listInstructions}
Each item must include 8-12 example compounds or sentences in meta.examples. Use character, meaning, onyomi, kunyomi, stroke_count. Optional: summary, image_prompt.
{ "title": "Character or meaning", "slug": "url-slug", "meta": { "character": "字", "meaning": "meaning", "onyomi": ["オン"], "kunyomi": ["くん"], "stroke_count": 5, "summary": "one line", "image_prompt": "optional", "examples": [ { "japanese": "word or sentence using this kanji", "romaji": "romaji", "translation": "English" }, ... 8 to 12 examples ] } }.`;

    case "reading":
      return `${BASE_BRAND}
Generate a list of ${count} JLPT ${level} reading practice topics/titles to create as separate lessons. ${scope}
${listInstructions}
Each item should include meta.sentences (8-12) with japanese, romaji, translation for reading practice. Optional: summary, image_prompt.
{ "title": "Reading topic or story title", "slug": "url-slug", "meta": { "summary": "brief description", "image_prompt": "optional", "sentences": [ { "japanese": "sentence (kanji/hiragana/katakana)", "romaji": "romaji", "translation": "English" }, ... 8 to 12 sentences ] } }.`;

    case "listening":
      return `${BASE_BRAND}
Generate a list of ${count} JLPT ${level} listening practice scenarios to create as separate lessons. ${scope}
${listInstructions}
Each item must include 8-12 example phrases/lines in meta.examples (japanese, romaji, translation). Optional: summary, image_prompt, audio_url.
{ "title": "Scenario (e.g. At the station)", "slug": "url-slug", "meta": { "summary": "brief description", "image_prompt": "optional", "examples": [ { "japanese": "phrase or dialogue line", "romaji": "romaji", "translation": "English" }, ... 8 to 12 examples ] } }.`;

    case "writing":
      return `${BASE_BRAND}
Generate a list of ${count} JLPT ${level} writing prompts/topics to create as separate lessons. ${scope}
${listInstructions}
Each item must include 8-12 example sentences or sample responses in meta.examples (japanese, romaji, translation). Optional: summary, image_prompt.
{ "title": "Writing prompt title", "slug": "url-slug", "meta": { "summary": "brief description", "image_prompt": "optional", "examples": [ { "japanese": "sample sentence or response", "romaji": "romaji", "translation": "English" }, ... 8 to 12 examples ] } }.`;

    case "sounds":
      return `${BASE_BRAND}
Generate a list of ${count} kana/pronunciation (sounds) lesson topics (e.g. hiragana rows, katakana rows, minimal pairs). ${scope}
${listInstructions}
Each item must include meta.characters: array of objects with hiragana, katakana, romaji, meaning (English). Optional: summary, image_prompt.
{ "title": "Topic (e.g. Hiragana あ-row)", "slug": "url-slug", "meta": { "summary": "brief description", "image_prompt": "optional", "characters": [ { "hiragana": "あ", "katakana": "ア", "romaji": "a", "meaning": "optional meaning" }, ... ] } }.`;

    case "study_guide":
      return `${BASE_BRAND}
Generate a list of ${count} JLPT study guide chapter/section titles (e.g. per level or per skill). ${scope}
${listInstructions}
Each item: { "title": "Chapter title (e.g. How to pass JLPT N5)", "slug": "url-slug", "meta": { "summary": "brief description" } }.`;

    case "practice_test":
      return `${BASE_BRAND}
Generate a list of ${count} practice test titles (e.g. Mock Test 1, 2; by section). ${scope}
${listInstructions}
Each item: { "title": "Test title", "slug": "url-slug", "meta": { "summary": "brief description" } }.`;

    default:
      return `${BASE_BRAND}
Generate a list of ${count} items for "${topic || contentType}" (JLPT ${level}). ${listInstructions}
Each item: { "title": "string", "slug": "url-slug" }.`;
  }
}
