/**
 * Remove the internal "## Admin Review Note" section that leaked into public-facing
 * kanji post content (an editorial/QA note never meant for learners — "This entry was
 * aligned to the public Kanshudo JLPT kanji collection and enriched with local dictionary
 * readings..."). Confirmed: always the final section in `posts.content`, single consistent
 * text variant across all 2,136 affected published kanji posts — a straightforward strip,
 * not a content-generation task.
 *
 * Idempotent: only matches rows still containing the heading, so safe to re-run.
 *
 * Run:
 *   npx tsx scripts/remove-admin-review-note.ts               # dry run
 *   npx tsx scripts/remove-admin-review-note.ts --apply=true  # write
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

const apply = process.argv.includes("--apply=true");
const HEADING_RE = /\n?## Admin Review Note[\s\S]*$/;

async function main() {
  console.log("Remove leaked Admin Review Note section from kanji content");
  console.log("mode:", apply ? "APPLY (writing)" : "DRY RUN (pass --apply=true to write)");

  const rows = (await sql`
    SELECT id, title, content FROM posts
    WHERE content_type = 'kanji' AND status = 'published' AND content ILIKE '%Admin Review Note%'
  `) as { id: string; title: string; content: string }[];

  console.log(`Candidates: ${rows.length}`);

  let cleaned = 0;
  let unchanged = 0;
  for (const r of rows) {
    const newContent = r.content.replace(HEADING_RE, "").trimEnd();
    if (newContent === r.content.trimEnd()) {
      console.log(`  SKIP (pattern didn't match as expected) — ${r.title}`);
      unchanged++;
      continue;
    }
    cleaned++;
    if (apply) {
      await sql`
        UPDATE posts SET content = ${newContent}, updated_at = NOW()
        WHERE id = ${r.id} AND content ILIKE '%Admin Review Note%'
      `;
    }
  }

  console.log(`\n${apply ? "Cleaned" : "Would clean"}: ${cleaned}, unchanged/skipped: ${unchanged}`);
  if (!apply) console.log("\nDry run only. Add --apply=true to write.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
