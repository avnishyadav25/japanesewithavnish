/**
 * Phase 1 (N5): Generate + insert lesson payload + examples + linked lists.
 *
 * - Ensures `curriculum_lessons.goal` + `introduction`
 * - Creates lesson `posts` for main + exercises and links via `curriculum_lesson_content`
 * - Generates vocabulary/grammar/kanji items as `posts` + inserts into type tables
 * - Links lesson ↔ vocab/grammar/kanji/kana tables
 * - Inserts lesson-scoped examples
 *
 * Run:
 *   npm run gen:n5-lessons
 *   npm run gen:n5-lessons -- --dry-run
 *
 * Env:
 *   DATABASE_URL (required)
 *   CONTENT_LLM=deepseek|gemini (optional, default deepseek if key present else placeholder)
 *   DEEPSEEK_API_KEY / GEMINI_API_KEY (optional)
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import * as fs from "fs";
import * as path from "path";

type LlmProvider = "deepseek" | "gemini" | "placeholder";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL required");
  process.exit(1);
}
const sql = neon(DATABASE_URL);

const REPO_ROOT = process.cwd();
const INVENTORY = path.join(REPO_ROOT, "docs", "curriculum-inventory-N5.csv");

function hasFlag(argv: string[], flag: string) {
  return argv.includes(flag);
}

function slugify(input: string): string {
  return (input || "")
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function csvSplitLine(line: string): string[] {
  // Minimal CSV parser for this file shape (quoted lesson_title).
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function pickProvider(): LlmProvider {
  const pref = (process.env.CONTENT_LLM || "").toLowerCase();
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (pref === "gemini" && geminiKey) return "gemini";
  if (pref === "deepseek" && deepseekKey) return "deepseek";
  if (deepseekKey) return "deepseek";
  if (geminiKey) return "gemini";
  return "placeholder";
}

async function loadPrompt(key: string): Promise<string | null> {
  try {
    const rows = (await sql`SELECT content FROM ai_prompts WHERE key = ${key} LIMIT 1`) as { content: string }[];
    return rows?.[0]?.content ?? null;
  } catch {
    return null;
  }
}

async function llmJson(systemPrompt: string, userMessage: string, maxTokens: number): Promise<string> {
  const provider = pickProvider();
  if (provider === "placeholder") {
    // Deterministic placeholder (still valid JSON expected by caller).
    return JSON.stringify({ placeholder: true, systemPrompt, userMessage }).slice(0, 2000);
  }

  if (provider === "gemini") {
    const geminiKey = process.env.GEMINI_API_KEY!;
    const model = "gemini-2.0-flash";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userMessage }] }],
          generationConfig: { temperature: 0.5, maxOutputTokens: maxTokens },
        }),
      }
    );
    if (!res.ok) throw new Error(`Gemini failed: ${await res.text()}`);
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }

  const deepseekKey = process.env.DEEPSEEK_API_KEY!;
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${deepseekKey}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.5,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek failed: ${await res.text()}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

function stripFences(raw: string) {
  return (raw || "").replace(/^```\w*\n?|\n?```$/g, "").trim();
}

async function genIntroGoal(levelCode: string, lessonTitle: string, existingGoal: string | null) {
  const fallback =
    'You are an expert Japanese curriculum writer. Reply with ONLY a valid JSON object: {"introduction":"...", "goal":"..."}.' +
    " No markdown, no extra text.";
  const system = (await loadPrompt("curriculum_lesson_intro")) ?? fallback;
  const user = `Lesson title: ${lessonTitle}. Level: ${levelCode}.${existingGoal ? ` Goal: ${existingGoal}.` : ""} Generate introduction and goal. Return ONLY JSON: {"introduction":"...", "goal":"..."}.`;
  const raw = await llmJson(system, user, 700);
  const cleaned = stripFences(raw);
  try {
    const parsed = JSON.parse(cleaned) as { introduction?: string; goal?: string };
    return {
      introduction: typeof parsed.introduction === "string" ? parsed.introduction.trim() : "",
      goal: typeof parsed.goal === "string" ? parsed.goal.trim() : existingGoal ?? "",
      provider: pickProvider(),
    };
  } catch {
    return {
      introduction: `In this lesson, you'll learn ${lessonTitle.toLowerCase()} and practice using it in simple Japanese.`,
      goal: existingGoal ?? `Understand and practice: ${lessonTitle}.`,
      provider: "placeholder" as const,
    };
  }
}

async function genVocab(levelCode: string, lessonTitle: string, count: number) {
  const fallback =
    'You are an expert Japanese curriculum writer. Each item: {"word":"...", "reading":"...", "meaning":"..."}.' +
    " Reply with ONLY a valid JSON array. No markdown, no extra text.";
  const system = (await loadPrompt("curriculum_lesson_vocab")) ?? fallback;
  const user = `Lesson: ${lessonTitle}. Level: ${levelCode}. Generate exactly ${count} vocabulary items. Return ONLY a JSON array: [{"word":"...", "reading":"...", "meaning":"..."}]. No markdown.`;
  const raw = await llmJson(system, user, 3500);
  const cleaned = stripFences(raw);
  try {
    const arr = JSON.parse(cleaned);
    if (!Array.isArray(arr)) throw new Error("not array");
    return arr
      .slice(0, count)
      .map((x: any) => ({
        word: typeof x?.word === "string" ? x.word.trim() : "",
        reading: typeof x?.reading === "string" ? x.reading.trim() : "",
        meaning: typeof x?.meaning === "string" ? x.meaning.trim() : "",
      }))
      .filter((x: any) => x.word && x.meaning);
  } catch {
    return [
      { word: "です", reading: "desu", meaning: "to be (polite)" },
      { word: "はい", reading: "hai", meaning: "yes" },
      { word: "いいえ", reading: "iie", meaning: "no" },
    ].slice(0, count);
  }
}

async function genGrammar(levelCode: string, lessonTitle: string, count: number) {
  const system =
    'You are an expert Japanese curriculum writer. Generate grammar points for a lesson. Reply with ONLY JSON array: ' +
    `[{"pattern":"...","structure":"...","meaning":"..."}]. No markdown, no extra text.`;
  const user = `Lesson: ${lessonTitle}. Level: ${levelCode}. Generate exactly ${count} grammar points suitable for this lesson. Return ONLY JSON array: [{"pattern":"...","structure":"...","meaning":"..."}].`;
  const raw = await llmJson(system, user, 2000);
  const cleaned = stripFences(raw);
  try {
    const arr = JSON.parse(cleaned);
    if (!Array.isArray(arr)) throw new Error("not array");
    return arr
      .slice(0, count)
      .map((x: any) => ({
        pattern: typeof x?.pattern === "string" ? x.pattern.trim() : "",
        structure: typeof x?.structure === "string" ? x.structure.trim() : "",
        meaning: typeof x?.meaning === "string" ? x.meaning.trim() : "",
      }))
      .filter((x: any) => x.pattern);
  } catch {
    return [{ pattern: "A は B です", structure: "A wa B desu", meaning: "A is B (polite)" }].slice(0, count);
  }
}

async function genKanji(levelCode: string, lessonTitle: string, count: number) {
  const system =
    "You are an expert Japanese curriculum writer. Generate beginner kanji list suitable for a lesson. Reply with ONLY JSON array: " +
    `[{"character":"...","meaning":"...","onyomi":["..."],"kunyomi":["..."]}]. No markdown, no extra text.`;
  const user = `Lesson: ${lessonTitle}. Level: ${levelCode}. Generate exactly ${count} kanji. Return ONLY JSON array: [{"character":"...","meaning":"...","onyomi":["..."],"kunyomi":["..."]}].`;
  const raw = await llmJson(system, user, 2000);
  const cleaned = stripFences(raw);
  try {
    const arr = JSON.parse(cleaned);
    if (!Array.isArray(arr)) throw new Error("not array");
    return arr
      .slice(0, count)
      .map((x: any) => ({
        character: typeof x?.character === "string" ? x.character.trim() : "",
        meaning: typeof x?.meaning === "string" ? x.meaning.trim() : "",
        onyomi: Array.isArray(x?.onyomi) ? x.onyomi.map((s: any) => String(s || "").trim()).filter(Boolean) : [],
        kunyomi: Array.isArray(x?.kunyomi) ? x.kunyomi.map((s: any) => String(s || "").trim()).filter(Boolean) : [],
      }))
      .filter((x: any) => x.character);
  } catch {
    return [
      { character: "日", meaning: "day/sun", onyomi: ["ニチ", "ジツ"], kunyomi: ["ひ", "か"] },
      { character: "人", meaning: "person", onyomi: ["ジン", "ニン"], kunyomi: ["ひと"] },
    ].slice(0, count);
  }
}

async function genExamples(levelCode: string, lessonTitle: string, count: number) {
  const fallback =
    'You are an expert Japanese curriculum writer. Reply with ONLY JSON array: [{"sentence_ja":"...","sentence_romaji":"...","sentence_en":"..."}].';
  const system = (await loadPrompt("curriculum_examples")) ?? fallback;
  const user = `Lesson: ${lessonTitle}. Level: ${levelCode}. Generate ${count} example sentences. Return ONLY JSON array: [{"sentence_ja":"...", "sentence_romaji":"...", "sentence_en":"..."}].`;
  const raw = await llmJson(system, user, 2500);
  const cleaned = stripFences(raw);
  try {
    const arr = JSON.parse(cleaned);
    if (!Array.isArray(arr)) throw new Error("not array");
    return arr.slice(0, count).map((x: any) => ({
      sentence_ja: typeof x?.sentence_ja === "string" ? x.sentence_ja.trim() : "",
      sentence_romaji: typeof x?.sentence_romaji === "string" ? x.sentence_romaji.trim() : "",
      sentence_en: typeof x?.sentence_en === "string" ? x.sentence_en.trim() : "",
    }));
  } catch {
    return [
      { sentence_ja: "わたしは がくせいです。", sentence_romaji: "Watashi wa gakusei desu.", sentence_en: "I am a student." },
      { sentence_ja: "これは ほんです。", sentence_romaji: "Kore wa hon desu.", sentence_en: "This is a book." },
    ].slice(0, count);
  }
}

async function ensureHiraganaKana() {
  const hiragana: { character: string; romaji: string; row: string; sort: number }[] = [
    // a
    { character: "あ", romaji: "a", row: "a", sort: 10 },
    { character: "い", romaji: "i", row: "a", sort: 11 },
    { character: "う", romaji: "u", row: "a", sort: 12 },
    { character: "え", romaji: "e", row: "a", sort: 13 },
    { character: "お", romaji: "o", row: "a", sort: 14 },
    // k
    { character: "か", romaji: "ka", row: "k", sort: 20 },
    { character: "き", romaji: "ki", row: "k", sort: 21 },
    { character: "く", romaji: "ku", row: "k", sort: 22 },
    { character: "け", romaji: "ke", row: "k", sort: 23 },
    { character: "こ", romaji: "ko", row: "k", sort: 24 },
    // s
    { character: "さ", romaji: "sa", row: "s", sort: 30 },
    { character: "し", romaji: "shi", row: "s", sort: 31 },
    { character: "す", romaji: "su", row: "s", sort: 32 },
    { character: "せ", romaji: "se", row: "s", sort: 33 },
    { character: "そ", romaji: "so", row: "s", sort: 34 },
    // t
    { character: "た", romaji: "ta", row: "t", sort: 40 },
    { character: "ち", romaji: "chi", row: "t", sort: 41 },
    { character: "つ", romaji: "tsu", row: "t", sort: 42 },
    { character: "て", romaji: "te", row: "t", sort: 43 },
    { character: "と", romaji: "to", row: "t", sort: 44 },
    // n
    { character: "な", romaji: "na", row: "n", sort: 50 },
    { character: "に", romaji: "ni", row: "n", sort: 51 },
    { character: "ぬ", romaji: "nu", row: "n", sort: 52 },
    { character: "ね", romaji: "ne", row: "n", sort: 53 },
    { character: "の", romaji: "no", row: "n", sort: 54 },
    // h
    { character: "は", romaji: "ha", row: "h", sort: 60 },
    { character: "ひ", romaji: "hi", row: "h", sort: 61 },
    { character: "ふ", romaji: "fu", row: "h", sort: 62 },
    { character: "へ", romaji: "he", row: "h", sort: 63 },
    { character: "ほ", romaji: "ho", row: "h", sort: 64 },
    // m
    { character: "ま", romaji: "ma", row: "m", sort: 70 },
    { character: "み", romaji: "mi", row: "m", sort: 71 },
    { character: "む", romaji: "mu", row: "m", sort: 72 },
    { character: "め", romaji: "me", row: "m", sort: 73 },
    { character: "も", romaji: "mo", row: "m", sort: 74 },
    // y
    { character: "や", romaji: "ya", row: "y", sort: 80 },
    { character: "ゆ", romaji: "yu", row: "y", sort: 81 },
    { character: "よ", romaji: "yo", row: "y", sort: 82 },
    // r
    { character: "ら", romaji: "ra", row: "r", sort: 90 },
    { character: "り", romaji: "ri", row: "r", sort: 91 },
    { character: "る", romaji: "ru", row: "r", sort: 92 },
    { character: "れ", romaji: "re", row: "r", sort: 93 },
    { character: "ろ", romaji: "ro", row: "r", sort: 94 },
    // w + n
    { character: "わ", romaji: "wa", row: "w", sort: 100 },
    { character: "を", romaji: "wo", row: "w", sort: 101 },
    { character: "ん", romaji: "n", row: "n", sort: 110 },
  ];

  for (const k of hiragana) {
    await sql`
      INSERT INTO kana (character, type, romaji, row_label, sort_order)
      VALUES (${k.character}, 'hiragana', ${k.romaji}, ${k.row}, ${k.sort})
      ON CONFLICT (character, type) DO UPDATE SET
        romaji = EXCLUDED.romaji,
        row_label = EXCLUDED.row_label,
        sort_order = EXCLUDED.sort_order,
        updated_at = NOW()
    `;
  }
}

function kanaRowsForLessonTitle(title: string): string[] {
  const t = (title || "").toLowerCase();
  if (t.includes("first 15") || (t.includes("a, k, s") && t.includes("rows"))) return ["a", "k", "s"];
  if (t.includes("t, n, and h")) return ["t", "n", "h"];
  if (t.includes("m, y, r, w")) return ["m", "y", "r", "w", "n"];
  if (t.includes("hiragana あ-row") || t.includes("hiragana a-row")) return ["a"];
  if (t.includes("hiragana か-row") || t.includes("hiragana ka-row")) return ["k"];
  return [];
}

async function createPost(args: {
  content_type: string;
  slug: string;
  title: string;
  content: string | null;
  jlpt_level: string;
  status: "published" | "draft";
  meta: Record<string, unknown>;
  tags?: string[];
  sort_order?: number;
}) {
  const rows = (await sql`
    INSERT INTO posts (content_type, slug, title, content, summary, jlpt_level, tags, og_image_url, image_prompt, status, published_at, sort_order, meta)
    VALUES (
      ${args.content_type},
      ${args.slug},
      ${args.title},
      ${args.content},
      ${typeof args.meta.summary === "string" ? (args.meta.summary as string) : null},
      ${args.jlpt_level ? [args.jlpt_level] : []},
      ${args.tags ?? []},
      ${typeof args.meta.feature_image_url === "string" ? (args.meta.feature_image_url as string) : null},
      ${typeof args.meta.image_prompt === "string" ? (args.meta.image_prompt as string) : null},
      ${args.status},
      ${args.status === "published" ? new Date().toISOString() : null},
      ${args.sort_order ?? 0},
      ${JSON.stringify(args.meta)}::jsonb
    )
    ON CONFLICT (slug) DO UPDATE SET
      title = EXCLUDED.title,
      content = EXCLUDED.content,
      jlpt_level = EXCLUDED.jlpt_level,
      tags = EXCLUDED.tags,
      og_image_url = EXCLUDED.og_image_url,
      image_prompt = EXCLUDED.image_prompt,
      status = EXCLUDED.status,
      published_at = EXCLUDED.published_at,
      sort_order = EXCLUDED.sort_order,
      meta = EXCLUDED.meta,
      updated_at = NOW()
    RETURNING id
  `) as { id: string }[];
  return rows[0]!.id;
}

async function ensureLessonContentPosts(levelCode: string, lessonId: string, lessonTitle: string) {
  const baseSlug = `${levelCode.toLowerCase()}-${slugify(lessonTitle)}`.slice(0, 70);
  const mainSlug = `${baseSlug}-main`;
  const ex1Slug = `${baseSlug}-ex-1`;
  const ex2Slug = `${baseSlug}-ex-2`;

  const existing = (await sql`
    SELECT content_role, content_slug
    FROM curriculum_lesson_content
    WHERE lesson_id = ${lessonId}
  `) as { content_role: string; content_slug: string }[];
  if (existing.length >= 1) return;

  const mainContent = `## ${lessonTitle}\n\nIn this lesson you’ll build practical intuition with clear examples and mini-drills.\n\n### Key takeaways\n- Understand the core idea\n- See 3–5 examples\n- Try short exercises\n`;
  const ex1 = `## Exercise 1\n\nFill in the blanks and read aloud.\n\n1) わたしは __ です。\n2) これは __ です。\n`;
  const ex2 = `## Exercise 2\n\nTranslate to Japanese (keep it simple).\n\n1) This is a pen.\n2) I am a student.\n`;

  const mainPostId = await createPost({
    content_type: "study_guide",
    slug: mainSlug,
    title: `${lessonTitle} (Main)`,
    content: mainContent,
    jlpt_level: levelCode,
    status: "published",
    meta: { summary: `Main lesson content for: ${lessonTitle}` },
    tags: [levelCode, "lesson", "curriculum"],
    sort_order: 0,
  });
  const ex1PostId = await createPost({
    content_type: "study_guide",
    slug: ex1Slug,
    title: `${lessonTitle} (Exercise 1)`,
    content: ex1,
    jlpt_level: levelCode,
    status: "published",
    meta: { summary: `Exercise 1 for: ${lessonTitle}` },
    tags: [levelCode, "exercise", "curriculum"],
    sort_order: 1,
  });
  const ex2PostId = await createPost({
    content_type: "study_guide",
    slug: ex2Slug,
    title: `${lessonTitle} (Exercise 2)`,
    content: ex2,
    jlpt_level: levelCode,
    status: "published",
    meta: { summary: `Exercise 2 for: ${lessonTitle}` },
    tags: [levelCode, "exercise", "curriculum"],
    sort_order: 2,
  });

  await sql`
    INSERT INTO curriculum_lesson_content (lesson_id, content_slug, post_id, content_role, sort_order)
    VALUES
      (${lessonId}, ${mainSlug}, ${mainPostId}, 'main', 0),
      (${lessonId}, ${ex1Slug}, ${ex1PostId}, 'exercise', 10),
      (${lessonId}, ${ex2Slug}, ${ex2PostId}, 'exercise', 20)
    ON CONFLICT DO NOTHING
  `;
}

async function upsertVocabPost(levelCode: string, lessonTitle: string, item: { word: string; reading: string; meaning: string }) {
  const base = slugify(`${levelCode}-vocab-${item.word}`) || `${levelCode.toLowerCase()}-vocab`;
  const slug = `${base}-${Math.abs(hashCode(item.word + item.meaning)).toString(36).slice(0, 6)}`;
  const postId = await createPost({
    content_type: "vocabulary",
    slug,
    title: item.word,
    content: null,
    jlpt_level: levelCode,
    status: "published",
    meta: {
      // Keep both shapes: (1) new sync script keys, (2) LearnMarkdown display keys.
      word: item.word,
      japanese: item.word,
      reading: item.reading,
      meaning: item.meaning,
      summary: `${item.word} — ${item.meaning}`,
      source_lesson: lessonTitle,
    },
    tags: [levelCode, "vocab", "curriculum"],
  });

  const vrows = (await sql`
    INSERT INTO vocabulary (post_id, word, reading, meaning, notes, updated_at)
    VALUES (${postId}, ${item.word}, ${item.reading || null}, ${item.meaning || null}, ${null}, NOW())
    ON CONFLICT (post_id) DO UPDATE SET
      word = EXCLUDED.word,
      reading = EXCLUDED.reading,
      meaning = EXCLUDED.meaning,
      updated_at = NOW()
    RETURNING id
  `) as { id: string }[];
  return vrows[0]!.id;
}

async function upsertGrammarPost(levelCode: string, lessonTitle: string, item: { pattern: string; structure: string; meaning: string }) {
  const base = slugify(`${levelCode}-grammar-${item.pattern}`) || `${levelCode.toLowerCase()}-grammar`;
  const slug = `${base}-${Math.abs(hashCode(item.pattern + item.meaning)).toString(36).slice(0, 6)}`;
  const postId = await createPost({
    content_type: "grammar",
    slug,
    title: item.pattern,
    content: null,
    jlpt_level: levelCode,
    status: "published",
    meta: {
      pattern: item.pattern,
      grammar_form: item.pattern,
      structure: item.structure,
      meaning: item.meaning,
      level: levelCode,
      summary: `${item.pattern} — ${item.meaning}`,
      source_lesson: lessonTitle,
    },
    tags: [levelCode, "grammar", "curriculum"],
  });

  const grows = (await sql`
    INSERT INTO grammar (post_id, pattern, structure, level, notes, updated_at)
    VALUES (${postId}, ${item.pattern}, ${item.structure || null}, ${levelCode}, ${null}, NOW())
    ON CONFLICT (post_id) DO UPDATE SET
      pattern = EXCLUDED.pattern,
      structure = EXCLUDED.structure,
      level = EXCLUDED.level,
      updated_at = NOW()
    RETURNING id
  `) as { id: string }[];
  return grows[0]!.id;
}

async function upsertKanjiPost(levelCode: string, lessonTitle: string, item: { character: string; meaning: string; onyomi: string[]; kunyomi: string[] }) {
  const base = slugify(`${levelCode}-kanji-${item.character}`) || `${levelCode.toLowerCase()}-kanji`;
  const slug = `${base}-${Math.abs(hashCode(item.character + item.meaning)).toString(36).slice(0, 6)}`;
  const postId = await createPost({
    content_type: "kanji",
    slug,
    title: item.character,
    content: null,
    jlpt_level: levelCode,
    status: "published",
    meta: {
      character: item.character,
      meaning: item.meaning,
      onyomi: item.onyomi,
      kunyomi: item.kunyomi,
      summary: `${item.character} — ${item.meaning}`,
      source_lesson: lessonTitle,
    },
    tags: [levelCode, "kanji", "curriculum"],
  });

  const krows = (await sql`
    INSERT INTO kanji (post_id, character, onyomi, kunyomi, stroke_count, meaning, notes, updated_at)
    VALUES (${postId}, ${item.character}, ${item.onyomi.length ? item.onyomi : null}, ${item.kunyomi.length ? item.kunyomi : null}, ${null}, ${item.meaning || null}, ${null}, NOW())
    ON CONFLICT (post_id) DO UPDATE SET
      character = EXCLUDED.character,
      onyomi = EXCLUDED.onyomi,
      kunyomi = EXCLUDED.kunyomi,
      meaning = EXCLUDED.meaning,
      updated_at = NOW()
    RETURNING id
  `) as { id: string }[];
  return krows[0]!.id;
}

function hashCode(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h | 0;
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = hasFlag(argv, "--dry-run");

  if (!fs.existsSync(INVENTORY)) {
    console.error("Missing inventory:", INVENTORY);
    process.exit(1);
  }
  const lines = fs.readFileSync(INVENTORY, "utf8").split(/\r?\n/).filter(Boolean);
  const header = lines.shift();
  if (!header) throw new Error("Inventory missing header");

  const TOTAL_COLS = 19;
  const FIXED_PREFIX_COLS = 4; // level_code,module_code,submodule_code,lesson_code
  const FIXED_SUFFIX_COLS = 14; // estimated_minutes..reading_glossary_count
  const lessonRows = lines
    .map((l) => csvSplitLine(l))
    .filter((cols) => cols[0] === "N5")
    .map((cols) => {
      // lesson_title sometimes contains commas without quotes; reconstruct by taking the "middle" slice.
      // Expected total columns: 19. The title is everything between prefix and suffix.
      const prefix = cols.slice(0, FIXED_PREFIX_COLS);
      const suffix = cols.slice(Math.max(FIXED_PREFIX_COLS, cols.length - FIXED_SUFFIX_COLS));
      const middle = cols.slice(FIXED_PREFIX_COLS, Math.max(FIXED_PREFIX_COLS, cols.length - FIXED_SUFFIX_COLS));
      const lesson_title_raw =
        middle.length
          ? middle.join(",")
          : cols.length === TOTAL_COLS
            ? cols[4] ?? ""
            : cols[4] ?? "";

      return {
        level_code: prefix[0] ?? "N5",
        lesson_title: (lesson_title_raw || "").replace(/^"|"$/g, "").trim(),
        _debug_cols: { prefix_len: prefix.length, middle_len: middle.length, suffix_len: suffix.length, total_len: cols.length },
      };
    })
    .filter((r) => r.lesson_title);

  console.log("N5 lessons in inventory:", lessonRows.length);

  if (!dryRun) {
    await ensureHiraganaKana();
  }

  for (const row of lessonRows) {
    const levelCode = row.level_code;
    const lessonTitle = row.lesson_title.replace(/,\s*/g, ", ").replace(/\s+/g, " ").trim();

    const lesson = (await sql`
      SELECT l.id, l.goal, l.introduction
      FROM curriculum_lessons l
      JOIN curriculum_submodules s ON s.id = l.submodule_id
      JOIN curriculum_modules m ON m.id = s.module_id
      JOIN curriculum_levels lvl ON lvl.id = m.level_id
      WHERE lvl.code = ${levelCode} AND l.title = ${lessonTitle}
      LIMIT 1
    `) as { id: string; goal: string | null; introduction: string | null }[];

    const lessonId = lesson[0]?.id;
    if (!lessonId) {
      console.warn("Skipping (lesson not found in DB):", levelCode, lessonTitle);
      continue;
    }

    const existingGoal = lesson[0].goal;
    const existingIntro = lesson[0].introduction;

    if (!existingGoal || !existingIntro) {
      const g = await genIntroGoal(levelCode, lessonTitle, existingGoal);
      if (!dryRun) {
        await sql`
          UPDATE curriculum_lessons
          SET goal = ${existingGoal && existingGoal.trim() ? existingGoal : g.goal},
              introduction = ${existingIntro && existingIntro.trim() ? existingIntro : g.introduction},
              updated_at = NOW()
          WHERE id = ${lessonId}
        `;
      }
    }

    if (!dryRun) {
      await ensureLessonContentPosts(levelCode, lessonId, lessonTitle);
    }

    // Linked lists (generate only if empty)
    const linkCounts = (await sql`
      SELECT
        (SELECT COUNT(*)::int FROM curriculum_lesson_vocabulary WHERE lesson_id = ${lessonId}) AS vocab_count,
        (SELECT COUNT(*)::int FROM curriculum_lesson_grammar WHERE lesson_id = ${lessonId}) AS grammar_count,
        (SELECT COUNT(*)::int FROM curriculum_lesson_kanji WHERE lesson_id = ${lessonId}) AS kanji_count,
        (SELECT COUNT(*)::int FROM curriculum_lesson_kana WHERE lesson_id = ${lessonId}) AS kana_count,
        (SELECT COUNT(*)::int FROM examples WHERE lesson_id = ${lessonId}) AS examples_count
    `) as { vocab_count: number; grammar_count: number; kanji_count: number; kana_count: number; examples_count: number }[];

    if (!dryRun && linkCounts[0].vocab_count === 0) {
      const vocab = await genVocab(levelCode, lessonTitle, 10);
      let sort = 0;
      for (const v of vocab) {
        const vocabId = await upsertVocabPost(levelCode, lessonTitle, v);
        await sql`
          INSERT INTO curriculum_lesson_vocabulary (lesson_id, vocabulary_id, sort_order)
          VALUES (${lessonId}, ${vocabId}, ${sort})
          ON CONFLICT (lesson_id, vocabulary_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, updated_at = NOW()
        `;
        sort += 10;
      }
    }

    if (!dryRun && linkCounts[0].grammar_count === 0) {
      const grammar = await genGrammar(levelCode, lessonTitle, 5);
      let sort = 0;
      for (const g of grammar) {
        const grammarId = await upsertGrammarPost(levelCode, lessonTitle, g);
        await sql`
          INSERT INTO curriculum_lesson_grammar (lesson_id, grammar_id, sort_order)
          VALUES (${lessonId}, ${grammarId}, ${sort})
          ON CONFLICT (lesson_id, grammar_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, updated_at = NOW()
        `;
        sort += 10;
      }
    }

    if (!dryRun && linkCounts[0].kanji_count === 0) {
      const kanji = await genKanji(levelCode, lessonTitle, 5);
      let sort = 0;
      for (const k of kanji) {
        const kanjiId = await upsertKanjiPost(levelCode, lessonTitle, k);
        await sql`
          INSERT INTO curriculum_lesson_kanji (lesson_id, kanji_id, sort_order)
          VALUES (${lessonId}, ${kanjiId}, ${sort})
          ON CONFLICT (lesson_id, kanji_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, updated_at = NOW()
        `;
        sort += 10;
      }
    }

    if (!dryRun && linkCounts[0].kana_count === 0) {
      const rows = kanaRowsForLessonTitle(lessonTitle);
      if (rows.length) {
        const kanaIds = (await sql`
          SELECT id, row_label, sort_order
          FROM kana
          WHERE type = 'hiragana' AND row_label = ANY(${rows}::text[])
          ORDER BY sort_order ASC
        `) as { id: string; row_label: string | null; sort_order: number }[];
        let sort = 0;
        for (const k of kanaIds) {
          await sql`
            INSERT INTO curriculum_lesson_kana (lesson_id, kana_id, sort_order)
            VALUES (${lessonId}, ${k.id}, ${sort})
            ON CONFLICT (lesson_id, kana_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, updated_at = NOW()
          `;
          sort += 1;
        }
      }
    }

    if (!dryRun && linkCounts[0].examples_count === 0) {
      const examples = await genExamples(levelCode, lessonTitle, 5);
      let sort = 0;
      for (const ex of examples) {
        if (!ex.sentence_ja || !ex.sentence_en) continue;
        await sql`
          INSERT INTO examples (lesson_id, sentence_ja, sentence_romaji, sentence_en, notes, sort_order)
          VALUES (${lessonId}, ${ex.sentence_ja}, ${ex.sentence_romaji || null}, ${ex.sentence_en}, ${null}, ${sort})
        `;
        sort += 10;
      }
    }

    console.log("OK:", levelCode, lessonTitle);
  }

  console.log("Phase 1 N5 generation done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

