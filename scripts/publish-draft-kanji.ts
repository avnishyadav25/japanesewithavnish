/**
 * Publish draft kanji posts that are genuinely ready: not a dedup-leftover (meta.merged_into_post_id
 * IS NULL — see below), has a complete sidecar `kanji` row (character/meaning/stroke_count), and has
 * a populated seo_description (run backfill-seo-descriptions.ts --status=draft --types=kanji first).
 *
 * Why the merged_into_post_id exclusion: a prior dedupe-learning-content pass merged some early kanji
 * drafts' content into a different (already-published) post for the same character and tagged the
 * loser with meta.merged_into_post_id, but never deleted the loser row. Publishing those would
 * resurrect content that was intentionally superseded, creating a live duplicate of an already-live
 * kanji page. As of 2026-08, 70 of 1,833 draft kanji are these leftovers.
 *
 * Idempotent: only ever touches rows where status = 'draft', so safe to re-run in batches.
 *
 * Run:
 *   npx tsx scripts/publish-draft-kanji.ts                    # dry run, all eligible rows
 *   npx tsx scripts/publish-draft-kanji.ts --limit=50          # dry run, first 50 (batch preview)
 *   npx tsx scripts/publish-draft-kanji.ts --apply=true --limit=200   # write, first 200
 *   npx tsx scripts/publish-draft-kanji.ts --apply=true        # write, all eligible rows
 *
 * Requires: DATABASE_URL in env/.env
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL required");
  process.exit(1);
}
const sql = neon(DATABASE_URL);

function getArg(name: string): string | null {
  const argv = process.argv.slice(2);
  const idx = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (idx === -1) return null;
  const a = argv[idx];
  return a.includes("=") ? a.split("=").slice(1).join("=") : argv[idx + 1] ?? "true";
}

const apply = getArg("apply") === "true";
const dryRun = !apply;
const limitArg = getArg("limit");
const limit = limitArg ? Math.max(1, parseInt(limitArg, 10)) : null;
const PREVIEW_LINES = 40;

async function main() {
  console.log("Publish draft kanji");
  console.log("mode:", dryRun ? "DRY RUN (pass --apply=true to write)" : "APPLY (writing to DATABASE_URL)");
  if (limit) console.log("limit:", limit);

  const excludedCount = (
    (await sql`
      SELECT COUNT(*) AS n FROM posts
      WHERE content_type = 'kanji' AND status = 'draft' AND (meta->>'merged_into_post_id') IS NOT NULL
    `) as { n: string }[]
  )[0].n;
  console.log(`Excluding ${excludedCount} dedup-leftover draft(s) (meta.merged_into_post_id set) — left untouched.`);

  const notReady = (
    (await sql`
      SELECT COUNT(*) AS n
      FROM posts p
      JOIN kanji k ON k.post_id = p.id
      WHERE p.content_type = 'kanji' AND p.status = 'draft'
        AND (p.meta->>'merged_into_post_id') IS NULL
        AND (p.seo_description IS NULL OR k.character IS NULL OR k.meaning IS NULL)
    `) as { n: string }[]
  )[0].n;
  if (Number(notReady) > 0) {
    console.log(
      `${notReady} genuine draft(s) are NOT ready yet (missing seo_description and/or sidecar character/meaning) — skipped. ` +
        `Run backfill-seo-descriptions.ts --status=draft --types=kanji first.`
    );
  }

  const rows = (await sql`
    SELECT p.id, p.title, p.published_at, k.character, COALESCE((p.jlpt_level)[1], k.jlpt_level) AS level
    FROM posts p
    JOIN kanji k ON k.post_id = p.id
    WHERE p.content_type = 'kanji' AND p.status = 'draft'
      AND (p.meta->>'merged_into_post_id') IS NULL
      AND p.seo_description IS NOT NULL
      AND k.character IS NOT NULL
      AND k.meaning IS NOT NULL
    ORDER BY p.created_at
    ${limit ? sql`LIMIT ${limit}` : sql``}
  `) as { id: string; title: string; published_at: string | null; character: string; level: string | null }[];

  console.log(`\nReady to publish: ${rows.length}`);
  rows.slice(0, PREVIEW_LINES).forEach((r) => {
    console.log(`  - ${r.character}${r.level ? ` (${r.level})` : ""} — ${r.title}`);
  });
  if (rows.length > PREVIEW_LINES) console.log(`  ... and ${rows.length - PREVIEW_LINES} more`);

  if (dryRun) {
    console.log(`\nWould publish ${rows.length} row(s).`);
    console.log("\nDry run only. Add --apply=true to write.");
    return;
  }

  let published = 0;
  for (const r of rows) {
    await sql`
      UPDATE posts
      SET status = 'published', published_at = COALESCE(published_at, NOW()), updated_at = NOW()
      WHERE id = ${r.id} AND status = 'draft'
    `;
    published++;
  }
  console.log(`\nPublished ${published} row(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
