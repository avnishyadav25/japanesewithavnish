/**
 * Phase 1 (any level): Generate + insert lesson payload + examples + linked lists.
 *
 * Run:
 *   npm run gen:level-lessons -- --level N4
 *   npm run gen:level-lessons -- --levels N4,N3,N2,N1
 *   npm run gen:level-lessons -- --levels N5 --dry-run
 *
 * Output:
 *   docs/curriculum-generation-status-<LEVEL>.json
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
const DOCS_DIR = path.join(REPO_ROOT, "docs");

function hasFlag(argv: string[], flag: string) {
  return argv.includes(flag);
}
function getArgValue(argv: string[], key: string): string | null {
  const idx = argv.findIndex((a) => a === key || a.startsWith(key + "="));
  if (idx === -1) return null;
  const a = argv[idx];
  if (a.includes("=")) return a.split("=").slice(1).join("=");
  return argv[idx + 1] ?? null;
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

function normalizeLessonTitle(s: string) {
  return (s || "").replace(/,\s*/g, ", ").replace(/\s+/g, " ").trim();
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

async function llm(systemPrompt: string, userMessage: string, maxTokens: number): Promise<string> {
  const provider = pickProvider();
  if (provider === "placeholder") return "";

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
    `You are an expert Japanese curriculum writer. Reply with ONLY a valid JSON object: {"introduction":"...", "goal":"..."}.`;
  const system = (await loadPrompt("curriculum_lesson_intro")) ?? fallback;
  const user = `Lesson title: ${lessonTitle}. Level: ${levelCode}.${existingGoal ? ` Goal: ${existingGoal}.` : ""} Return ONLY JSON: {"introduction":"...", "goal":"..."}.`;
  const raw = await llm(system, user, 700);
  const cleaned = stripFences(raw);
  if (!cleaned) {
    return {
      introduction: `In this lesson, you'll learn ${lessonTitle.toLowerCase()} and practice using it in simple Japanese.`,
      goal: existingGoal ?? `Understand and practice: ${lessonTitle}.`,
    };
  }
  try {
    const parsed = JSON.parse(cleaned) as { introduction?: string; goal?: string };
    return {
      introduction: typeof parsed.introduction === "string" ? parsed.introduction.trim() : "",
      goal: typeof parsed.goal === "string" ? parsed.goal.trim() : existingGoal ?? "",
    };
  } catch {
    return {
      introduction: `In this lesson, you'll learn ${lessonTitle.toLowerCase()} and practice using it in simple Japanese.`,
      goal: existingGoal ?? `Understand and practice: ${lessonTitle}.`,
    };
  }
}

async function genList(
  kind: "vocab" | "grammar" | "kanji",
  levelCode: string,
  lessonTitle: string,
  count: number
) {
  const system =
    kind === "vocab"
      ? ((await loadPrompt("curriculum_lesson_vocab")) ??
        `Return ONLY JSON array: [{"word":"...","reading":"...","meaning":"..."}].`)
      : kind === "grammar"
        ? `Return ONLY JSON array: [{"pattern":"...","structure":"...","meaning":"..."}].`
        : `Return ONLY JSON array: [{"character":"...","meaning":"...","onyomi":["..."],"kunyomi":["..."]}].`;
  const user =
    kind === "vocab"
      ? `Lesson: ${lessonTitle}. Level: ${levelCode}. Generate exactly ${count} items. Return ONLY JSON array: [{"word":"...","reading":"...","meaning":"..."}].`
      : kind === "grammar"
        ? `Lesson: ${lessonTitle}. Level: ${levelCode}. Generate exactly ${count} grammar points. Return ONLY JSON array: [{"pattern":"...","structure":"...","meaning":"..."}].`
        : `Lesson: ${lessonTitle}. Level: ${levelCode}. Generate exactly ${count} kanji. Return ONLY JSON array: [{"character":"...","meaning":"...","onyomi":["..."],"kunyomi":["..."]}].`;
  const raw = await llm(system, user, 3500);
  const cleaned = stripFences(raw);
  if (!cleaned) return [];
  try {
    const arr = JSON.parse(cleaned);
    return Array.isArray(arr) ? arr.slice(0, count) : [];
  } catch {
    return [];
  }
}

async function genExamples(levelCode: string, lessonTitle: string, count: number) {
  const system =
    (await loadPrompt("curriculum_examples")) ??
    `Return ONLY JSON array: [{"sentence_ja":"...","sentence_romaji":"...","sentence_en":"..."}].`;
  const user = `Lesson: ${lessonTitle}. Level: ${levelCode}. Generate ${count} example sentences. Return ONLY JSON array.`;
  const raw = await llm(system, user, 2500);
  const cleaned = stripFences(raw);
  if (!cleaned) return [];
  try {
    const arr = JSON.parse(cleaned);
    return Array.isArray(arr) ? arr.slice(0, count) : [];
  } catch {
    return [];
  }
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
      status = EXCLUDED.status,
      published_at = EXCLUDED.published_at,
      sort_order = EXCLUDED.sort_order,
      meta = EXCLUDED.meta,
      updated_at = NOW()
    RETURNING id
  `) as { id: string }[];
  return rows[0]!.id;
}

function hashCode(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h | 0;
}

async function ensureLessonContentPosts(levelCode: string, lessonId: string, lessonTitle: string) {
  const baseSlug = `${levelCode.toLowerCase()}-${slugify(lessonTitle)}`.slice(0, 70);
  const mainSlug = `${baseSlug}-main`;
  const ex1Slug = `${baseSlug}-ex-1`;
  const ex2Slug = `${baseSlug}-ex-2`;

  const existing = (await sql`
    SELECT content_role FROM curriculum_lesson_content WHERE lesson_id = ${lessonId}
  `) as { content_role: string }[];
  if (existing.some((x) => x.content_role === "main")) return;

  const mainContent = `## ${lessonTitle}\n\n### Key takeaways\n- Understand the core idea\n- See examples\n- Try short exercises\n`;
  const ex1 = `## Exercise 1\n\n1) __\n2) __\n`;
  const ex2 = `## Exercise 2\n\nWrite 2 sentences using what you learned.\n`;

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

async function upsertVocabPost(levelCode: string, lessonTitle: string, item: any) {
  const word = String(item?.word ?? "").trim();
  const reading = String(item?.reading ?? "").trim();
  const meaning = String(item?.meaning ?? "").trim();
  if (!word || !meaning) return null;
  const base = slugify(`${levelCode}-vocab-${word}`) || `${levelCode.toLowerCase()}-vocab`;
  const slug = `${base}-${Math.abs(hashCode(word + meaning)).toString(36).slice(0, 6)}`;
  const postId = await createPost({
    content_type: "vocabulary",
    slug,
    title: word,
    content: null,
    jlpt_level: levelCode,
    status: "published",
    meta: { word, japanese: word, reading, meaning, summary: `${word} — ${meaning}`, source_lesson: lessonTitle },
    tags: [levelCode, "vocab", "curriculum"],
  });
  const rows = (await sql`
    INSERT INTO vocabulary (post_id, word, reading, meaning, notes, updated_at)
    VALUES (${postId}, ${word}, ${reading || null}, ${meaning || null}, ${null}, NOW())
    ON CONFLICT (post_id) DO UPDATE SET
      word = EXCLUDED.word,
      reading = EXCLUDED.reading,
      meaning = EXCLUDED.meaning,
      updated_at = NOW()
    RETURNING id
  `) as { id: string }[];
  return rows[0]!.id;
}

async function upsertGrammarPost(levelCode: string, lessonTitle: string, item: any) {
  const pattern = String(item?.pattern ?? "").trim();
  const structure = String(item?.structure ?? "").trim();
  const meaning = String(item?.meaning ?? "").trim();
  if (!pattern) return null;
  const base = slugify(`${levelCode}-grammar-${pattern}`) || `${levelCode.toLowerCase()}-grammar`;
  const slug = `${base}-${Math.abs(hashCode(pattern + meaning)).toString(36).slice(0, 6)}`;
  const postId = await createPost({
    content_type: "grammar",
    slug,
    title: pattern,
    content: null,
    jlpt_level: levelCode,
    status: "published",
    meta: { pattern, grammar_form: pattern, structure, meaning, level: levelCode, summary: `${pattern} — ${meaning}`, source_lesson: lessonTitle },
    tags: [levelCode, "grammar", "curriculum"],
  });
  const rows = (await sql`
    INSERT INTO grammar (post_id, pattern, structure, level, notes, updated_at)
    VALUES (${postId}, ${pattern}, ${structure || null}, ${levelCode}, ${null}, NOW())
    ON CONFLICT (post_id) DO UPDATE SET
      pattern = EXCLUDED.pattern,
      structure = EXCLUDED.structure,
      level = EXCLUDED.level,
      updated_at = NOW()
    RETURNING id
  `) as { id: string }[];
  return rows[0]!.id;
}

async function upsertKanjiPost(levelCode: string, lessonTitle: string, item: any) {
  const character = String(item?.character ?? "").trim();
  const meaning = String(item?.meaning ?? "").trim();
  const onyomi = Array.isArray(item?.onyomi) ? item.onyomi.map((x: any) => String(x ?? "").trim()).filter(Boolean) : [];
  const kunyomi = Array.isArray(item?.kunyomi) ? item.kunyomi.map((x: any) => String(x ?? "").trim()).filter(Boolean) : [];
  if (!character) return null;
  const base = slugify(`${levelCode}-kanji-${character}`) || `${levelCode.toLowerCase()}-kanji`;
  const slug = `${base}-${Math.abs(hashCode(character + meaning)).toString(36).slice(0, 6)}`;
  const postId = await createPost({
    content_type: "kanji",
    slug,
    title: character,
    content: null,
    jlpt_level: levelCode,
    status: "published",
    meta: { character, meaning, onyomi, kunyomi, summary: `${character} — ${meaning}`, source_lesson: lessonTitle },
    tags: [levelCode, "kanji", "curriculum"],
  });
  const rows = (await sql`
    INSERT INTO kanji (post_id, character, onyomi, kunyomi, stroke_count, meaning, notes, updated_at)
    VALUES (${postId}, ${character}, ${onyomi.length ? onyomi : null}, ${kunyomi.length ? kunyomi : null}, ${null}, ${meaning || null}, ${null}, NOW())
    ON CONFLICT (post_id) DO UPDATE SET
      character = EXCLUDED.character,
      onyomi = EXCLUDED.onyomi,
      kunyomi = EXCLUDED.kunyomi,
      meaning = EXCLUDED.meaning,
      updated_at = NOW()
    RETURNING id
  `) as { id: string }[];
  return rows[0]!.id;
}

async function processLevel(levelCode: string, dryRun: boolean) {
  const inventory = path.join(DOCS_DIR, `curriculum-inventory-${levelCode}.csv`);
  if (!fs.existsSync(inventory)) {
    console.warn("Missing inventory:", inventory);
    return { levelCode, ok: false, error: "missing_inventory" as const };
  }

  const lines = fs.readFileSync(inventory, "utf8").split(/\r?\n/).filter(Boolean);
  lines.shift(); // header

  const TOTAL_COLS = 19;
  const FIXED_PREFIX_COLS = 4;
  const FIXED_SUFFIX_COLS = 14;
  const lessonRows = lines
    .map((l) => csvSplitLine(l))
    .filter((cols) => cols[0] === levelCode)
    .map((cols) => {
      const middle = cols.slice(FIXED_PREFIX_COLS, Math.max(FIXED_PREFIX_COLS, cols.length - FIXED_SUFFIX_COLS));
      const lesson_title_raw =
        middle.length ? middle.join(",") : cols.length === TOTAL_COLS ? cols[4] ?? "" : cols[4] ?? "";
      return { lesson_title: normalizeLessonTitle(lesson_title_raw) };
    })
    .filter((r) => r.lesson_title);

  const status = {
    levelCode,
    generatedAt: new Date().toISOString(),
    provider: pickProvider(),
    lessons: lessonRows.length,
    processed: 0,
    skippedNotFound: 0,
    updatedIntroGoal: 0,
    createdLessonBlocks: 0,
    linkedVocab: 0,
    linkedGrammar: 0,
    linkedKanji: 0,
    insertedExamples: 0,
  };

  for (const r of lessonRows) {
    const lessonTitle = r.lesson_title;
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
      status.skippedNotFound += 1;
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
      status.updatedIntroGoal += 1;
    }

    if (!dryRun) {
      const before = await sql`SELECT COUNT(*)::int AS c FROM curriculum_lesson_content WHERE lesson_id = ${lessonId}` as { c: number }[];
      await ensureLessonContentPosts(levelCode, lessonId, lessonTitle);
      const after = await sql`SELECT COUNT(*)::int AS c FROM curriculum_lesson_content WHERE lesson_id = ${lessonId}` as { c: number }[];
      if ((after[0]?.c ?? 0) > (before[0]?.c ?? 0)) status.createdLessonBlocks += 1;
    }

    const linkCounts = (await sql`
      SELECT
        (SELECT COUNT(*)::int FROM curriculum_lesson_vocabulary WHERE lesson_id = ${lessonId}) AS vocab_count,
        (SELECT COUNT(*)::int FROM curriculum_lesson_grammar WHERE lesson_id = ${lessonId}) AS grammar_count,
        (SELECT COUNT(*)::int FROM curriculum_lesson_kanji WHERE lesson_id = ${lessonId}) AS kanji_count,
        (SELECT COUNT(*)::int FROM examples WHERE lesson_id = ${lessonId}) AS examples_count
    `) as { vocab_count: number; grammar_count: number; kanji_count: number; examples_count: number }[];

    if (!dryRun && linkCounts[0].vocab_count === 0) {
      const vocab = await genList("vocab", levelCode, lessonTitle, 10);
      let sort = 0;
      for (const v of vocab) {
        const vocabId = await upsertVocabPost(levelCode, lessonTitle, v);
        if (!vocabId) continue;
        await sql`
          INSERT INTO curriculum_lesson_vocabulary (lesson_id, vocabulary_id, sort_order)
          VALUES (${lessonId}, ${vocabId}, ${sort})
          ON CONFLICT (lesson_id, vocabulary_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, updated_at = NOW()
        `;
        sort += 10;
        status.linkedVocab += 1;
      }
    }

    if (!dryRun && linkCounts[0].grammar_count === 0) {
      const grammar = await genList("grammar", levelCode, lessonTitle, 5);
      let sort = 0;
      for (const g of grammar) {
        const grammarId = await upsertGrammarPost(levelCode, lessonTitle, g);
        if (!grammarId) continue;
        await sql`
          INSERT INTO curriculum_lesson_grammar (lesson_id, grammar_id, sort_order)
          VALUES (${lessonId}, ${grammarId}, ${sort})
          ON CONFLICT (lesson_id, grammar_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, updated_at = NOW()
        `;
        sort += 10;
        status.linkedGrammar += 1;
      }
    }

    if (!dryRun && linkCounts[0].kanji_count === 0) {
      const kanji = await genList("kanji", levelCode, lessonTitle, 5);
      let sort = 0;
      for (const k of kanji) {
        const kanjiId = await upsertKanjiPost(levelCode, lessonTitle, k);
        if (!kanjiId) continue;
        await sql`
          INSERT INTO curriculum_lesson_kanji (lesson_id, kanji_id, sort_order)
          VALUES (${lessonId}, ${kanjiId}, ${sort})
          ON CONFLICT (lesson_id, kanji_id) DO UPDATE SET sort_order = EXCLUDED.sort_order, updated_at = NOW()
        `;
        sort += 10;
        status.linkedKanji += 1;
      }
    }

    if (!dryRun && linkCounts[0].examples_count === 0) {
      const examples = await genExamples(levelCode, lessonTitle, 5);
      let sort = 0;
      for (const ex of examples) {
        const ja = typeof ex?.sentence_ja === "string" ? ex.sentence_ja.trim() : "";
        const en = typeof ex?.sentence_en === "string" ? ex.sentence_en.trim() : "";
        const romaji = typeof ex?.sentence_romaji === "string" ? ex.sentence_romaji.trim() : "";
        if (!ja || !en) continue;
        await sql`
          INSERT INTO examples (lesson_id, sentence_ja, sentence_romaji, sentence_en, notes, sort_order)
          VALUES (${lessonId}, ${ja}, ${romaji || null}, ${en}, ${null}, ${sort})
        `;
        sort += 10;
        status.insertedExamples += 1;
      }
    }

    status.processed += 1;
  }

  if (!dryRun) {
    const outPath = path.join(DOCS_DIR, `curriculum-generation-status-${levelCode}.json`);
    fs.writeFileSync(outPath, JSON.stringify(status, null, 2));
  }

  return { levelCode, ok: true, status };
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = hasFlag(argv, "--dry-run");
  const level = (getArgValue(argv, "--level") || "").toUpperCase();
  const levelsRaw = getArgValue(argv, "--levels");
  const levels = levelsRaw
    ? levelsRaw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
    : level
      ? [level]
      : ["N5"];

  for (const lvl of levels) {
    if (!/^N[1-5]$/.test(lvl)) {
      console.warn("Skipping invalid level:", lvl);
      continue;
    }
    console.log("Processing level:", lvl);
    const res = await processLevel(lvl, dryRun);
    if (!res.ok) console.warn("Level failed:", lvl, (res as any).error);
    else console.log("Done level:", lvl);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

