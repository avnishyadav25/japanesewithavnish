/**
 * One-off repair: 20 published N1 vocabulary posts have NULL word/reading/meaning in the
 * `vocabulary` sidecar table even though the real data survives elsewhere on the row —
 * word+reading in posts.title (format "word (reading)"), meaning embedded as free text in
 * the already-correct posts.seo_description (format "word (reading) means MEANING. Learn it
 * as part of LEVEL Japanese grammar practice."). Discovered while building
 * generate-vocab-examples.ts, which was sending literal null/null to the AI for these rows.
 *
 * Idempotent: only touches rows where word IS NULL OR meaning IS NULL, and only writes a
 * field it successfully parsed (never overwrites a field that's already non-null).
 *
 * IMPORTANT: some of these NULL-sidecar rows turned out to be duplicates of an already-
 * published, complete vocabulary entry (same word+reading, different post, often a different
 * JLPT level) rather than merely incompletely-synced data — a unique constraint
 * (idx_vocabulary_normalized_word_reading_unique) confirmed this on the first real run. This
 * script checks for an existing duplicate before writing and skips (does not repair) any row
 * that has one, since repairing it would create a second live page for the same word.
 *
 * Run:
 *   npx tsx scripts/fix-null-vocab-sidecar.ts               # dry run
 *   npx tsx scripts/fix-null-vocab-sidecar.ts --apply=true  # write
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

const TITLE_RE = /^(.+?)\s*\(([^)]+)\)\s*$/;
const MEANING_RE = /means\s+(.+?)\.\s*Learn it as part of/i;

async function main() {
  console.log("Fix NULL vocabulary sidecar rows");
  console.log("mode:", apply ? "APPLY (writing)" : "DRY RUN (pass --apply=true to write)");

  const rows = (await sql`
    SELECT p.id AS post_id, v.id AS vocabulary_id, p.title, p.seo_description, v.word, v.reading, v.meaning
    FROM posts p JOIN vocabulary v ON v.post_id = p.id
    WHERE p.status = 'published' AND (v.word IS NULL OR v.meaning IS NULL)
    ORDER BY p.created_at
  `) as {
    post_id: string;
    vocabulary_id: string;
    title: string;
    seo_description: string | null;
    word: string | null;
    reading: string | null;
    meaning: string | null;
  }[];

  console.log(`Candidates: ${rows.length}`);

  let parsed = 0;
  let unparseable = 0;
  let duplicates = 0;

  for (const r of rows) {
    const titleMatch = r.title.match(TITLE_RE);
    const meaningMatch = r.seo_description?.match(MEANING_RE);
    const word = r.word ?? titleMatch?.[1]?.trim() ?? null;
    const reading = r.reading ?? titleMatch?.[2]?.trim() ?? null;
    const meaning = r.meaning ?? meaningMatch?.[1]?.trim() ?? null;

    if (!word || !meaning) {
      console.log(`  SKIP (couldn't parse) — title="${r.title}" desc="${r.seo_description}"`);
      unparseable++;
      continue;
    }

    const dup = (await sql`
      SELECT p2.slug FROM vocabulary v2 JOIN posts p2 ON p2.id = v2.post_id
      WHERE LOWER(TRIM(v2.word)) = LOWER(TRIM(${word}))
        AND COALESCE(LOWER(TRIM(v2.reading)), '') = COALESCE(LOWER(TRIM(${reading})), '')
        AND v2.post_id != ${r.post_id}
    `) as { slug: string }[];
    if (dup.length > 0) {
      console.log(`  SKIP (duplicate of ${dup[0].slug}) — ${r.title}`);
      duplicates++;
      continue;
    }

    console.log(`  ${r.title} -> word="${word}" reading="${reading ?? "—"}" meaning="${meaning}"`);
    parsed++;

    if (apply) {
      await sql`
        UPDATE vocabulary
        SET word = COALESCE(word, ${word}), reading = COALESCE(reading, ${reading}), meaning = COALESCE(meaning, ${meaning}), updated_at = NOW()
        WHERE id = ${r.vocabulary_id} AND (word IS NULL OR meaning IS NULL)
      `;
    }
  }

  console.log(`\n${apply ? "Fixed" : "Would fix"}: ${parsed}, duplicates (skipped): ${duplicates}, unparseable: ${unparseable}`);
  if (!apply) console.log("\nDry run only. Add --apply=true to write.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
