/**
 * Deletes 10 published posts (9 vocabulary + 1 kanji) that turned out to be duplicates of
 * already-existing, complete, published posts for the same word/character. Each of these 10
 * has a broken key field (vocabulary.word IS NULL, or kanji.character corrupted to U+FFFD),
 * and investigation confirmed the "real" data they'd need already lives in a separate,
 * complete, published post elsewhere. No real cross-references found (curriculum_lesson_content,
 * content_blocks, examples do not point at these post IDs from anywhere else) — the shared
 * ID-suffix some of these have with N1 grammar-lesson posts is coincidental batch-naming, not
 * a functional link (confirmed by reading the grammar posts' content/meta directly).
 *
 * Usage: npx tsx scripts/delete-duplicate-word-posts.ts [--apply=true]
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const apply = process.argv.includes("--apply=true");

const VOCAB_IDS = [
  "bcafcebe-cc30-46ea-84bc-d7afd56876eb", // 事実
  "3b5b2e12-5661-4634-9656-5c7b047b9cf5", // 傾向
  "1933be39-10b7-412d-ba2a-30243cff92fa", // 唯一
  "bd6cffd0-30e9-4d64-84ed-86ee4b71ae7b", // 基準
  "abbf0e71-68e2-4766-93bf-44b4fa995770", // 後悔
  "0aec0c05-25e0-4c00-8e5a-7f0920a45869", // 状況
  "ef56a8d6-1bdd-41e8-9fdb-5632cd396300", // 規則
  "18a5a2ba-cc74-4d04-a125-fa69ba7b0b9a", // 評価
  "18ba9a4a-8ead-463c-917d-5b13390f6407", // 責任
];
const KANJI_ID = "3c2bc57a-8669-4482-ac66-50c9ac7fc490"; // 件 (corrupted to U+FFFD)

async function main() {
  const ids = [...VOCAB_IDS, KANJI_ID];

  const rows = (await sql`
    SELECT id, slug, title, content_type FROM posts WHERE id = ANY(${ids})
  `) as { id: string; slug: string; title: string; content_type: string }[];

  if (rows.length !== 10) {
    console.error(`Expected exactly 10 rows, found ${rows.length}. Aborting — re-verify before proceeding.`);
    process.exit(1);
  }

  console.log(`${rows.length} posts to delete:`);
  for (const r of rows) {
    console.log(`  - [${r.content_type}] [${r.slug}] "${r.title}" (${r.id})`);
  }

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply=true to delete.");
    return;
  }

  const deleted = (await sql`DELETE FROM posts WHERE id = ANY(${ids}) RETURNING id`) as { id: string }[];
  console.log(`\nDeleted ${deleted.length} posts.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
