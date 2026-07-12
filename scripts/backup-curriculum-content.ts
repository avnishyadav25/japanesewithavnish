/**
 * Phase 3 (Curriculum CMS): dumps every lesson's current Markdown-based content
 * (main + exercise posts, linked vocab/grammar/kanji/kana, examples) to a
 * timestamped JSON file before the block migration touches anything.
 *
 * Run: npx tsx scripts/backup-curriculum-content.ts
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { writeFileSync } from "fs";
import { join } from "path";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
const sql = neon(DATABASE_URL);

async function main() {
  const lessons = await sql`
    SELECT id, code, title, content_type FROM curriculum_lessons ORDER BY code
  `;

  const content = await sql`
    SELECT clc.lesson_id, clc.content_role, clc.content_slug, p.id AS post_id,
           p.title, p.content, p.meta, p.content_type AS post_content_type
    FROM curriculum_lesson_content clc
    JOIN posts p ON p.id = clc.post_id
  `;

  const vocab = await sql`
    SELECT clv.lesson_id, v.id, v.word, v.reading, v.meaning
    FROM curriculum_lesson_vocabulary clv JOIN vocabulary v ON v.id = clv.vocabulary_id
  `;
  const grammar = await sql`
    SELECT clg.lesson_id, g.id, g.pattern, g.structure, g.notes
    FROM curriculum_lesson_grammar clg JOIN grammar g ON g.id = clg.grammar_id
  `;
  const kanji = await sql`
    SELECT clk.lesson_id, k.id, k.character, k.meaning
    FROM curriculum_lesson_kanji clk JOIN kanji k ON k.id = clk.kanji_id
  `;
  const kana = await sql`
    SELECT clk.lesson_id, k.id, k.character
    FROM curriculum_lesson_kana clk JOIN kana k ON k.id = clk.kana_id
  `;
  const examples = await sql`
    SELECT id, lesson_id, vocabulary_id, grammar_id, sentence_ja, sentence_romaji, sentence_en, notes, sort_order
    FROM examples WHERE lesson_id IS NOT NULL
  `;

  const byLesson = (rows: { lesson_id: string }[], lessonId: string) => rows.filter((r) => r.lesson_id === lessonId);

  const dump = (lessons as { id: string; code: string; title: string; content_type: string | null }[]).map((lesson) => ({
    lesson,
    content: byLesson(content as { lesson_id: string }[], lesson.id),
    vocabulary: byLesson(vocab as { lesson_id: string }[], lesson.id),
    grammar: byLesson(grammar as { lesson_id: string }[], lesson.id),
    kanji: byLesson(kanji as { lesson_id: string }[], lesson.id),
    kana: byLesson(kana as { lesson_id: string }[], lesson.id),
    examples: byLesson(examples as { lesson_id: string }[], lesson.id),
  }));

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = join(__dirname, "backups", `curriculum-pre-block-migration-${timestamp}.json`);
  writeFileSync(outPath, JSON.stringify(dump, null, 2));

  console.log(`Backed up ${dump.length} lessons to ${outPath}`);
  console.log(`Total content rows: ${(content as unknown[]).length}, examples: ${(examples as unknown[]).length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
