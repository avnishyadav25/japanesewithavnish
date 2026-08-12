/**
 * Backfills the `sounds` sidecar table for published content_type='sounds' posts that have
 * never had one written (data has only ever lived in posts.meta since this content type's
 * ingestion pipeline never wired up a sidecar INSERT). `title` <- posts.title, `level` <-
 * posts.jlpt_level[0], `notes` <- posts.meta->>'summary' (the closest existing field to a
 * one-line note).
 *
 * Usage: npx tsx scripts/backfill-sounds-sidecar.ts [--apply=true]
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const apply = process.argv.includes("--apply=true");

async function main() {
  const rows = (await sql`
    SELECT p.id, p.title, p.jlpt_level, p.meta->>'summary' as notes
    FROM posts p
    WHERE p.content_type = 'sounds' AND p.status = 'published'
      AND NOT EXISTS (SELECT 1 FROM sounds s WHERE s.post_id = p.id)
    ORDER BY p.title
  `) as { id: string; title: string; jlpt_level: string[] | null; notes: string | null }[];

  console.log(`${rows.length} sounds posts missing a sidecar row`);
  for (const r of rows) {
    console.log(`  - "${r.title}" level=${r.jlpt_level?.[0] ?? "null"} notes="${(r.notes ?? "").slice(0, 60)}..."`);
  }

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply=true to insert.");
    return;
  }

  let inserted = 0;
  for (const r of rows) {
    await sql`
      INSERT INTO sounds (post_id, title, level, notes)
      VALUES (${r.id}, ${r.title}, ${r.jlpt_level?.[0] ?? null}, ${r.notes})
    `;
    inserted++;
  }
  console.log(`\nInserted ${inserted} sounds rows.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
