/**
 * Deletes the 17 published posts (12 grammar + 5 vocabulary) that are actually single
 * hiragana characters or consonant-row groups wrongly filed under content_type='grammar'/
 * 'vocabulary', with templated placeholder content ("Focus on the connection pattern
 * first..."). Confirmed redundant with the real 92-row `kana` table.
 *
 * Selection criterion: published grammar/vocabulary posts with NO matching sidecar row
 * (the defining signal — these posts were never real grammar points or vocabulary words,
 * so no `grammar`/`vocabulary` sidecar row was ever created for them). Deliberately NOT
 * scoped by `meta->>'source_lesson'` alone — that marker is far broader and also matches
 * legitimate content from the same generation batch (real N5 kanji, real vocabulary words,
 * real verb-conjugation grammar examples) that must NOT be deleted.
 *
 * Usage: npx tsx scripts/delete-misclassified-hiragana-posts.ts [--apply=true]
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const apply = process.argv.includes("--apply=true");

async function main() {
  const grammarOrphans = (await sql`
    SELECT p.id, p.title, p.slug
    FROM posts p
    WHERE p.content_type = 'grammar' AND p.status = 'published'
      AND NOT EXISTS (SELECT 1 FROM grammar g WHERE g.post_id = p.id)
    ORDER BY p.slug
  `) as { id: string; title: string; slug: string }[];

  const vocabOrphans = (await sql`
    SELECT p.id, p.title, p.slug
    FROM posts p
    WHERE p.content_type = 'vocabulary' AND p.status = 'published'
      AND NOT EXISTS (SELECT 1 FROM vocabulary v WHERE v.post_id = p.id)
    ORDER BY p.slug
  `) as { id: string; title: string; slug: string }[];

  const all = [...grammarOrphans, ...vocabOrphans];
  console.log(`grammar orphans: ${grammarOrphans.length}`);
  console.log(`vocab orphans: ${vocabOrphans.length}`);
  console.log(`total to delete: ${all.length}`);
  for (const p of all) console.log(`  - [${p.slug}] "${p.title}" (${p.id})`);

  if (all.length !== 17) {
    console.error(`Expected exactly 17 rows, found ${all.length}. Aborting — re-verify before proceeding.`);
    process.exit(1);
  }

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply=true to delete.");
    return;
  }

  const ids = all.map((p) => p.id);
  const deleted = (await sql`
    DELETE FROM posts WHERE id = ANY(${ids}) RETURNING id
  `) as { id: string }[];
  console.log(`\nDeleted ${deleted.length} posts.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
