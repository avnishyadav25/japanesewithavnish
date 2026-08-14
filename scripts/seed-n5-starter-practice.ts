/**
 * Seed starter practice artifacts for EVERY N5 lesson.
 *
 * Populates:
 * - `grammar_drill_items` (>= 2 items per lesson, tied to lesson_id)
 * - `listening_scenarios` + `listening_questions` (one scenario per lesson, tied to a per-lesson listening post)
 * - `reading_glossary` (one glossary entry per lesson, tied to a per-lesson reading post)
 *
 * Why "per-lesson" posts?
 * Student listening + reading UIs are global pickers/sandbox, so the simplest way
 * to guarantee "every N5 lesson has practice" is to create one listening and one
 * reading post per curriculum lesson, and attach practice artifacts to them.
 *
 * Runs idempotently using deterministic slugs derived from lesson_id.
 *
 * Run:
 *   npm run seed:n5-practice
 *   npm run seed:n5-practice -- --regenerate
 *
 * Env:
 *   DATABASE_URL required
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

type Neondb = ReturnType<typeof neon>;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const sql = neon(DATABASE_URL) as Neondb;

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
    .slice(0, 90);
}

function hashCode(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h | 0;
}

function getOrCreatePostSlug(kind: "listening" | "reading", lessonId: string) {
  return slugify(`n5-practice-${kind}-${lessonId}`);
}

async function upsertPost(args: {
  content_type: "listening" | "reading";
  slug: string;
  title: string;
  jlpt_level: string;
  content: string | null;
  meta: Record<string, unknown>;
}) {
  const rows = (await sql`
    INSERT INTO posts (
      content_type,
      slug,
      title,
      content,
      summary,
      jlpt_level,
      tags,
      status,
      published_at,
      sort_order,
      meta
    )
    VALUES (
      ${args.content_type},
      ${args.slug},
      ${args.title},
      ${args.content},
      ${typeof args.meta.summary === "string" ? (args.meta.summary as string) : null},
      ${[args.jlpt_level]},
      ${["N5", "practice", args.content_type]},
      ${"published"},
      ${new Date().toISOString()},
      ${0},
      ${JSON.stringify(args.meta)}::jsonb
    )
    ON CONFLICT (slug) DO UPDATE SET
      title = EXCLUDED.title,
      content = EXCLUDED.content,
      jlpt_level = EXCLUDED.jlpt_level,
      tags = EXCLUDED.tags,
      meta = EXCLUDED.meta,
      status = EXCLUDED.status,
      published_at = EXCLUDED.published_at,
      sort_order = EXCLUDED.sort_order,
      updated_at = NOW()
    RETURNING id
  `) as { id: string }[];
  return rows[0]!.id;
}

async function ensureListeningTypeRow(postId: string, lessonId: string) {
  const rows = (await sql`
    INSERT INTO listening (post_id, title, level, audio_url, notes, updated_at)
    VALUES (
      ${postId},
      ${`Listening practice for lesson ${lessonId}`},
      ${"N5"},
      ${"/api/audio/silence"},
      ${null},
      NOW()
    )
    ON CONFLICT (post_id) DO UPDATE SET
      title = EXCLUDED.title,
      level = EXCLUDED.level,
      audio_url = EXCLUDED.audio_url,
      notes = EXCLUDED.notes,
      updated_at = NOW()
    RETURNING id
  `) as { id: string }[];
  return rows[0]!.id;
}

async function ensureReadingGlossary(postId: string, lessonTitle: string) {
  const segmentText = "こんにちは";
  const content = (await sql`
    SELECT content FROM posts WHERE id = ${postId} LIMIT 1
  `) as { content: string | null }[];

  const c = (content[0]?.content ?? "").toString();
  if (!c.trim()) return { inserted: 0, skipped: true };
  const start = c.indexOf(segmentText);
  if (start === -1) return { inserted: 0, skipped: true };
  const end = start + segmentText.length;

  // One glossary entry per lesson (MVP seed).
  await sql`DELETE FROM reading_glossary WHERE post_id = ${postId}`;
  await sql`
    INSERT INTO reading_glossary (
      post_id,
      segment_text,
      segment_start,
      segment_end,
      definition_text,
      vocabulary_id,
      grammar_id,
      sort_order
    )
    VALUES (
      ${postId},
      ${segmentText},
      ${start},
      ${end},
      ${"Hello"},
      ${null},
      ${null},
      ${0}
    )
  `;
  // Touch at least one glossary row
  return { inserted: 1, skipped: false };
}

async function ensureListeningScenarioAndQuestions(listeningId: string, lessonTitle: string) {
  await sql`
    DELETE FROM listening_questions
    WHERE scenario_id IN (
      SELECT id FROM listening_scenarios WHERE listening_id = ${listeningId}
    )
  `;
  await sql`DELETE FROM listening_scenarios WHERE listening_id = ${listeningId}`;

  const scenarioRows = (await sql`
    INSERT INTO listening_scenarios (listening_id, title, audio_url, transcript, sort_order)
    VALUES (
      ${listeningId},
      ${`Listening practice: ${lessonTitle}`},
      ${"/api/audio/silence"},
      ${"こんにちは。わたしは学生です。"},
      ${0}
    )
    RETURNING id
  `) as { id: string }[];

  const scenarioId = scenarioRows[0]?.id;
  if (!scenarioId) throw new Error("Failed to insert listening_scenarios");

  const q = [
    {
      questionText: "Who is speaking?",
      options: ["A student", "A teacher", "A doctor", "A farmer"],
      correctIndex: 0,
      sort: 0,
    },
    {
      questionText: "What does the speaker say first?",
      options: ["Good morning", "Hello", "Good night", "Sorry"],
      correctIndex: 1,
      sort: 10,
    },
  ];

  for (const qq of q) {
    await sql`
      INSERT INTO listening_questions (
        scenario_id,
        question_text,
        options,
        correct_index,
        sort_order
      )
      VALUES (
        ${scenarioId},
        ${qq.questionText},
        ${JSON.stringify(qq.options)}::jsonb,
        ${qq.correctIndex},
        ${qq.sort}
      )
    `;
  }

  return { insertedScenarios: 1, insertedQuestions: q.length };
}

async function ensureGrammarDrills(lessonId: string, lessonTitle: string) {
  // Deterministic minimal drills per lesson (MVP).
  const items = [
    {
      sentence_ja: "わたしは __ がくせいです。",
      correct: ["は"],
      distractors: ["が", "を", "に", "で"],
      hint: "Topic particle は (MVP)",
    },
    {
      sentence_ja: "これは __ ほんです。",
      correct: ["が"],
      distractors: ["は", "を", "に", "で"],
      hint: "Subject/object particle が (MVP)",
    },
  ];

  await sql`DELETE FROM grammar_drill_items WHERE lesson_id = ${lessonId}`;
  let sort = 0;
  let inserted = 0;
  for (const it of items) {
    await sql`
      INSERT INTO grammar_drill_items (
        lesson_id,
        grammar_id,
        sentence_ja,
        correct_answers,
        distractors,
        hint,
        sort_order
      )
      VALUES (
        ${lessonId},
        ${null},
        ${it.sentence_ja},
        ${JSON.stringify(it.correct)}::jsonb,
        ${JSON.stringify(it.distractors)}::jsonb,
        ${it.hint},
        ${sort}
      )
    `;
    inserted += 1;
    sort += 10;
  }

  return { inserted };
}

async function main() {
  const argv = process.argv.slice(2);
  const regenerate = hasFlag(argv, "--regenerate");

  // Select all N5 lessons.
  const n5Lessons = (await sql`
    SELECT l.id, l.title
    FROM curriculum_lessons l
    JOIN curriculum_submodules sm ON sm.id = l.submodule_id
    JOIN curriculum_modules m ON m.id = sm.module_id
    JOIN curriculum_levels lvl ON lvl.id = m.level_id
    WHERE lvl.code = 'N5'
    ORDER BY l.sort_order, l.title
  `) as { id: string; title: string }[];

  if (!n5Lessons.length) throw new Error("No N5 lessons found");
  console.log(`N5 lessons found: ${n5Lessons.length}`);

  let drillsTotal = 0;
  let scenariosTotal = 0;
  let questionsTotal = 0;
  let glossaryTotal = 0;

  for (const lesson of n5Lessons) {
    const lessonId = lesson.id;
    const lessonTitle = lesson.title;
    const listeningSlug = getOrCreatePostSlug("listening", lessonId);
    const readingSlug = getOrCreatePostSlug("reading", lessonId);

    // Grammar drills: if not regenerate and already exists, keep it.
    const drillCountRows = (await sql`
      SELECT COUNT(*)::int AS c FROM grammar_drill_items WHERE lesson_id = ${lessonId}
    `) as { c: number }[];
    const drillCount = drillCountRows[0]?.c ?? 0;
    if (regenerate || drillCount === 0) {
      const r = await ensureGrammarDrills(lessonId, lessonTitle);
      drillsTotal += r.inserted;
    }

    // Listening: create per-lesson listening post + type row, then 1 scenario + 2 questions.
    const listeningPostRows = (await sql`
      SELECT id FROM posts WHERE slug = ${listeningSlug} AND content_type = 'listening' LIMIT 1
    `) as { id: string }[];
    const listeningPostId =
      listeningPostRows[0]?.id ??
      (await upsertPost({
        content_type: "listening",
        slug: listeningSlug,
        title: `Listening practice: ${lessonTitle}`,
        jlpt_level: "N5",
        content: null,
        meta: {
          summary: `Listening practice for: ${lessonTitle}`,
          lesson_title: lessonTitle,
          kind: "practice",
          seed: hashCode(listeningSlug),
        },
      }));

    const listeningTypeId = await ensureListeningTypeRow(listeningPostId, lessonId);
    const scenarioCountRows = (await sql`
      SELECT COUNT(*)::int AS c FROM listening_scenarios WHERE listening_id = ${listeningTypeId}
    `) as { c: number }[];
    const scenarioCount = scenarioCountRows[0]?.c ?? 0;
    if (regenerate || scenarioCount === 0) {
      const r = await ensureListeningScenarioAndQuestions(listeningTypeId, lessonTitle);
      scenariosTotal += r.insertedScenarios;
      questionsTotal += r.insertedQuestions;
    }

    // Reading: create per-lesson reading post + 1 glossary entry.
    const readingPostRows = (await sql`
      SELECT id FROM posts WHERE slug = ${readingSlug} AND content_type = 'reading' LIMIT 1
    `) as { id: string }[];
    const readingPostId =
      readingPostRows[0]?.id ??
      (await upsertPost({
        content_type: "reading",
        slug: readingSlug,
        title: `Reading practice: ${lessonTitle}`,
        jlpt_level: "N5",
        content: `# Reading practice: ${lessonTitle}\n\nこんにちは。\nわたしは学生です。${lessonTitle}をべんきょうします。`,
        meta: {
          summary: `Reading practice for: ${lessonTitle}`,
          lesson_title: lessonTitle,
          kind: "practice",
          seed: hashCode(readingSlug),
        },
      }));

    const glossaryCountRows = (await sql`
      SELECT COUNT(*)::int AS c FROM reading_glossary WHERE post_id = ${readingPostId}
    `) as { c: number }[];
    const glossaryCount = glossaryCountRows[0]?.c ?? 0;
    if (regenerate || glossaryCount === 0) {
      const r = await ensureReadingGlossary(readingPostId, lessonTitle);
      glossaryTotal += r.inserted;
    }
  }

  console.log("Seed complete:", {
    drillsTotal,
    scenariosTotal,
    questionsTotal,
    glossaryTotal,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

