/**
 * Pre-launch content backfill: reading passages + placement-quiz questions.
 *
 * - Reading: tops up `posts` (content_type=reading) + `reading` type table +
 *   `reading_glossary` to READING_TARGET items per JLPT level.
 * - Quiz: tops up `quiz_questions` to QUIZ_TARGET per JLPT level.
 *
 * Text generation only (Gemini primary, OpenRouter fallback) — no image APIs,
 * per launch decision. Idempotent: counts existing rows and only fills gaps.
 *
 * Usage: npx tsx scripts/backfill-reading-quiz.ts [--dry-run]
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const dryRun = process.argv.includes("--dry-run");

const LEVELS = ["N5", "N4", "N3", "N2", "N1"];
const READING_TARGET = 6;
const QUIZ_TARGET = 30;

const geminiKey = process.env.GEMINI_API_KEY;
const openrouterKey = process.env.OPENROUTER_API_KEY;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanJSONString(raw: string): string {
  let clean = raw.replace(/^```\w*\n?|\n?```$/g, "").trim();
  const first = Math.min(
    clean.indexOf("[") === -1 ? Infinity : clean.indexOf("["),
    clean.indexOf("{") === -1 ? Infinity : clean.indexOf("{")
  );
  const last = Math.max(clean.lastIndexOf("]"), clean.lastIndexOf("}"));
  if (first !== Infinity && last > first) clean = clean.slice(first, last + 1);
  return clean.replace(/,\s*([\]}])/g, "$1").replace(/[“”]/g, '"');
}

async function callGemini(system: string, user: string, maxTokens: number): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: maxTokens },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini failed: ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callOpenRouter(system: string, user: string, maxTokens: number): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openrouterKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-chat-v3-0324",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: maxTokens,
      temperature: 0.8,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter failed: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// OpenRouter first — the Gemini key on this project currently returns 403.
async function callLLM(system: string, user: string, maxTokens: number): Promise<string> {
  if (openrouterKey) {
    try {
      return await callOpenRouter(system, user, maxTokens);
    } catch (e) {
      console.warn("OpenRouter failed, falling back to Gemini:", (e as Error).message.slice(0, 200));
    }
  }
  if (geminiKey) return callGemini(system, user, maxTokens);
  throw new Error("No LLM API key configured (GEMINI_API_KEY or OPENROUTER_API_KEY)");
}

// ---------- Reading ----------

async function backfillReading(level: string) {
  const [{ count }] = (await sql`
    SELECT count(*)::int AS count FROM posts
    WHERE content_type = 'reading' AND ${level} = ANY(jlpt_level) AND status = 'published'
  `) as { count: number }[];
  const needed = READING_TARGET - count;
  console.log(`[reading ${level}] have ${count}, need ${Math.max(0, needed)}`);
  if (needed <= 0) return;

  const existingTitles = (
    (await sql`
      SELECT title FROM posts WHERE content_type = 'reading' AND ${level} = ANY(jlpt_level)
    `) as { title: string }[]
  ).map((r) => r.title);

  for (let i = 0; i < needed; i++) {
    const sys =
      'You are an experienced Japanese teacher writing JLPT graded readers. Output ONLY a valid JSON object: {"title":"(English title)","content":"(Japanese passage using ONLY grammar/vocab/kanji appropriate for the given JLPT level; use kana for kanji above the level)","summary":"(1-sentence English summary)","glossary":[{"text":"(exact substring from content)","definition":"(English meaning + reading in romaji)"}]}. The passage must be 150-400 Japanese characters, natural and interesting (daily life, culture, small stories). Provide 6-10 glossary items whose text appears VERBATIM in the passage. Strict JSON, double quotes only.';
    const user = `JLPT level: ${level}. Write reading passage #${i + 1}. Avoid these existing topics: ${existingTitles.join("; ") || "none"}.`;

    try {
      const raw = await callLLM(sys, user, 3000);
      const data = JSON.parse(cleanJSONString(raw));
      const title = String(data.title || "").trim();
      const content = String(data.content || "").trim();
      const summary = String(data.summary || "").trim();
      if (!title || !content) {
        console.warn(`[reading ${level}] empty response, skipping`);
        continue;
      }
      existingTitles.push(title);

      if (dryRun) {
        console.log(`[reading ${level}] (dry) would insert: ${title}`);
        continue;
      }

      const slug = slugify(`${level}-reading-${title.slice(0, 40)}-${Math.random().toString(36).slice(2, 6)}`);
      const [post] = (await sql`
        INSERT INTO posts (content_type, slug, title, content, summary, jlpt_level, tags, status, published_at, meta)
        VALUES ('reading', ${slug}, ${title}, ${content}, ${summary || `Comprehension reading: ${title}`},
                ${[level]}, ${[level, "reading"]}, 'published', NOW(),
                ${JSON.stringify({ summary })}::jsonb)
        RETURNING id
      `) as { id: string }[];

      await sql`
        INSERT INTO reading (post_id, title, level, updated_at)
        VALUES (${post.id}, ${title}, ${level}, NOW())
        ON CONFLICT (post_id) DO UPDATE SET title = EXCLUDED.title, level = EXCLUDED.level, updated_at = NOW()
      `;

      const glossary = Array.isArray(data.glossary) ? data.glossary : [];
      let inserted = 0;
      for (const g of glossary) {
        const gText = String(g.text || "").trim();
        const gDef = String(g.definition || "").trim();
        if (!gText || !gDef) continue;
        const start = content.indexOf(gText);
        if (start === -1) continue;
        await sql`
          INSERT INTO reading_glossary (post_id, segment_text, segment_start, segment_end, definition_text)
          VALUES (${post.id}, ${gText}, ${start}, ${start + gText.length}, ${gDef})
        `;
        inserted++;
      }
      console.log(`[reading ${level}] inserted "${title}" (${inserted} glossary items)`);
    } catch (e) {
      console.error(`[reading ${level}] failed:`, (e as Error).message.slice(0, 300));
    }
  }
}

// ---------- Quiz ----------

async function backfillQuiz(level: string) {
  const rows = (await sql`
    SELECT count(*)::int AS count, coalesce(max(sort_order), 0)::int AS max_sort
    FROM quiz_questions WHERE jlpt_level = ${level}
  `) as { count: number; max_sort: number }[];
  const { count, max_sort } = rows[0];
  const needed = QUIZ_TARGET - count;
  console.log(`[quiz ${level}] have ${count}, need ${Math.max(0, needed)}`);
  if (needed <= 0) return;

  const existing = (
    (await sql`SELECT question_text FROM quiz_questions WHERE jlpt_level = ${level}`) as {
      question_text: string;
    }[]
  ).map((r) => r.question_text);

  const sys =
    'You are a JLPT exam writer. Output ONLY a valid JSON array of multiple-choice questions: [{"question_text":"...","options":["...","...","...","..."],"correct_index":0}]. Each question tests vocabulary, kanji reading, grammar, or usage at EXACTLY the given JLPT level. Questions in English referencing Japanese (with kana/kanji), 4 options each, exactly one correct. Vary question types. Strict JSON, double quotes only.';
  const user = `JLPT level: ${level}. Write ${needed} NEW placement-quiz questions. Do NOT duplicate any of these existing questions:\n${existing.join("\n")}`;

  try {
    const raw = await callLLM(sys, user, 8000);
    const data = JSON.parse(cleanJSONString(raw));
    if (!Array.isArray(data)) throw new Error("expected JSON array");

    let sort = max_sort;
    let inserted = 0;
    for (const q of data.slice(0, needed)) {
      const text = String(q.question_text || "").trim();
      const options = Array.isArray(q.options) ? q.options.map(String) : [];
      const correct = Number(q.correct_index);
      if (!text || options.length !== 4 || !(correct >= 0 && correct <= 3)) continue;
      if (existing.includes(text)) continue;
      sort += 1;
      if (!dryRun) {
        await sql`
          INSERT INTO quiz_questions (question_text, options, correct_index, jlpt_level, sort_order)
          VALUES (${text}, ${JSON.stringify(options)}::jsonb, ${correct}, ${level}, ${sort})
        `;
      }
      inserted++;
    }
    console.log(`[quiz ${level}] inserted ${inserted}${dryRun ? " (dry run)" : ""}`);
  } catch (e) {
    console.error(`[quiz ${level}] failed:`, (e as Error).message.slice(0, 300));
  }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
  for (const level of LEVELS) {
    await backfillReading(level);
    await backfillQuiz(level);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
