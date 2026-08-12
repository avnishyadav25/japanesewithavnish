/**
 * Read-only data-integrity audit of the live Neon database. No --apply flag exists —
 * this script never writes. Two layers:
 *
 *   Layer 0 — schema-enforcement introspection: confirms the FK/UNIQUE constraints the
 *   migration files (supabase/migrations/039, 042, 117) claim are actually present on
 *   live Neon (it was populated via a separate manual migration path, so drift is
 *   plausible in principle even though this run found none).
 *
 *   Layer 1 — business-logic checks FK constraints don't cover: reverse completeness
 *   (post -> sidecar direction isn't FK-enforced, only sidecar -> post is), content-type/
 *   sidecar-table mismatches, examples coverage/outliers/duplicates for today's vocab
 *   example-sentence batch, kanji publish-eligibility slippage against
 *   publish-draft-kanji.ts's own bar, orphaned meta->>'merged_into_post_id' pointers, and
 *   posts.meta JSONB consistency (typeof anomalies, stale seo_description/seo_title
 *   duplicates, rare/deprecated per-content_type keys).
 *
 * Run: npx tsx scripts/check-data-integrity.ts
 * Requires: DATABASE_URL in env/.env
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { writeFileSync } from "fs";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL required");
  process.exit(1);
}
const sql = neon(DATABASE_URL);

const SIDECAR_TABLES = ["vocabulary", "grammar", "kanji", "reading", "listening", "sounds", "writing"] as const;

type CheckResult = { name: string; count: number; note?: string; sample?: unknown[] };
const results: CheckResult[] = [];

function record(name: string, count: number, sample?: unknown[], note?: string) {
  results.push({ name, count, sample: sample?.slice(0, 20), note });
  const flag = count > 0 ? "⚠" : "✓";
  console.log(`${flag} ${name}: ${count}${note ? ` (${note})` : ""}`);
}

async function layer0SchemaIntrospection() {
  console.log("\n=== Layer 0: schema-enforcement introspection ===");
  const tableList = [...SIDECAR_TABLES, "examples"];
  const constraints = (await sql`
    SELECT tc.table_name, tc.constraint_type, kcu.column_name
    FROM information_schema.table_constraints tc
    LEFT JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = ANY(${tableList})
      AND tc.constraint_type IN ('FOREIGN KEY', 'UNIQUE')
  `) as { table_name: string; constraint_type: string; column_name: string }[];

  for (const table of SIDECAR_TABLES) {
    const hasFk = constraints.some((c) => c.table_name === table && c.constraint_type === "FOREIGN KEY" && c.column_name === "post_id");
    const hasUnique = constraints.some((c) => c.table_name === table && c.constraint_type === "UNIQUE" && c.column_name === "post_id");
    record(`${table}.post_id has FK -> posts.id`, hasFk ? 0 : 1, undefined, hasFk ? undefined : "MISSING — expected per migration 039");
    record(`${table}.post_id has UNIQUE`, hasUnique ? 0 : 1, undefined, hasUnique ? undefined : "MISSING — expected per migration 039");
  }
  for (const col of ["vocabulary_id", "grammar_id", "kanji_id", "lesson_id"]) {
    const hasFk = constraints.some((c) => c.table_name === "examples" && c.constraint_type === "FOREIGN KEY" && c.column_name === col);
    record(`examples.${col} has FK`, hasFk ? 0 : 1, undefined, hasFk ? undefined : "MISSING");
  }
}

// Table names here come only from the fixed internal SIDECAR_TABLES whitelist (never user
// input), so direct interpolation into the SQL text is safe — Postgres has no placeholder
// syntax for identifiers, so this is the only way to parameterize a table name at all.
async function layer1ReverseCompleteness() {
  console.log("\n=== Layer 1: reverse completeness (post -> sidecar) ===");
  for (const table of SIDECAR_TABLES) {
    const rows = (await sql.query(
      `SELECT p.id, p.slug, p.status FROM posts p
       WHERE p.content_type = $1 AND p.status = 'published'
         AND NOT EXISTS (SELECT 1 FROM ${table} s WHERE s.post_id = p.id)`,
      [table]
    )) as unknown as { id: string; slug: string; status: string }[];
    record(`published '${table}' posts with no sidecar row`, rows.length, rows.map((r) => r.slug));
  }
}

async function layer1ContentTypeMismatch() {
  console.log("\n=== Layer 1: content_type / sidecar table mismatches ===");
  for (const table of SIDECAR_TABLES) {
    const rows = (await sql.query(
      `SELECT p.id, p.slug, p.content_type FROM ${table} s
       JOIN posts p ON p.id = s.post_id
       WHERE p.content_type IS DISTINCT FROM $1`,
      [table]
    )) as unknown as { id: string; slug: string; content_type: string }[];
    record(`'${table}' sidecar rows whose post.content_type != '${table}'`, rows.length, rows.map((r) => `${r.slug} (${r.content_type})`));
  }
}

async function layer1ExamplesHealth() {
  console.log("\n=== Layer 1: examples table health (today's vocab batch) ===");

  const zero = (await sql`
    SELECT p.slug FROM posts p JOIN vocabulary v ON v.post_id = p.id
    WHERE p.status = 'published' AND NOT EXISTS (SELECT 1 FROM examples e WHERE e.vocabulary_id = v.id)
  `) as { slug: string }[];
  record("published vocab posts with zero examples", zero.length, zero.map((r) => r.slug));

  const outliers = (await sql`
    SELECT v.id, p.slug, COUNT(e.id) n
    FROM vocabulary v JOIN posts p ON p.id = v.post_id
    LEFT JOIN examples e ON e.vocabulary_id = v.id
    WHERE p.status = 'published'
    GROUP BY v.id, p.slug
    HAVING COUNT(e.id) > 10
  `) as { id: string; slug: string; n: number }[];
  record("vocab items with implausibly many examples (>10)", outliers.length, outliers.map((r) => `${r.slug}: ${r.n}`));

  const dupes = (await sql`
    SELECT vocabulary_id, sentence_ja, COUNT(*) n
    FROM examples WHERE vocabulary_id IS NOT NULL
    GROUP BY vocabulary_id, sentence_ja
    HAVING COUNT(*) > 1
  `) as { vocabulary_id: string; sentence_ja: string; n: number }[];
  record("duplicate (vocabulary_id, sentence_ja) pairs in examples", dupes.length, dupes.map((r) => `${r.vocabulary_id}: "${r.sentence_ja}" x${r.n}`), "generator's NOT EXISTS guard should prevent this");

  const emptySentence = (await sql`
    SELECT id FROM examples WHERE sentence_ja IS NULL OR TRIM(sentence_ja) = '' OR sentence_en IS NULL OR TRIM(sentence_en) = ''
  `) as { id: string }[];
  record("examples rows with empty sentence_ja/sentence_en", emptySentence.length, emptySentence.map((r) => r.id));
}

async function layer1KanjiPublishEligibility() {
  console.log("\n=== Layer 1: kanji publish-eligibility slippage ===");
  const ineligible = (await sql`
    SELECT p.id, p.slug
    FROM posts p JOIN kanji k ON k.post_id = p.id
    WHERE p.content_type = 'kanji' AND p.status = 'published'
      AND (k.character IS NULL OR k.meaning IS NULL OR (p.meta->>'merged_into_post_id') IS NOT NULL)
  `) as { id: string; slug: string }[];
  record("published kanji failing publish-draft-kanji.ts's own eligibility bar", ineligible.length, ineligible.map((r) => r.slug));
}

async function layer1SoftReferences() {
  console.log("\n=== Layer 1: soft (non-FK) meta references ===");
  const orphaned = (await sql`
    SELECT p.id, p.slug, p.meta->>'merged_into_post_id' AS target
    FROM posts p
    WHERE p.meta->>'merged_into_post_id' IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM posts t WHERE t.id = (p.meta->>'merged_into_post_id')::uuid)
  `) as { id: string; slug: string; target: string }[];
  record("meta.merged_into_post_id pointers that don't resolve", orphaned.length, orphaned.map((r) => `${r.slug} -> ${r.target}`));
}

async function layer1MetaConsistency() {
  console.log("\n=== Layer 1: posts.meta JSONB consistency ===");

  const typeAnomalies = (await sql`
    SELECT id, slug, jsonb_typeof(meta) t FROM posts WHERE meta IS NOT NULL AND jsonb_typeof(meta) != 'object'
  `) as { id: string; slug: string; t: string }[];
  record("posts.meta not a JSON object", typeAnomalies.length, typeAnomalies.map((r) => `${r.slug}: ${r.t}`));

  const descMismatch = (await sql`
    SELECT slug FROM posts WHERE meta ? 'seo_description' AND meta->>'seo_description' IS DISTINCT FROM seo_description
  `) as { slug: string }[];
  record("meta.seo_description differs from posts.seo_description column", descMismatch.length, descMismatch.map((r) => r.slug));

  const titleMismatch = (await sql`
    SELECT slug FROM posts WHERE meta ? 'seo_title' AND meta->>'seo_title' IS DISTINCT FROM seo_title
  `) as { slug: string }[];
  record("meta.seo_title differs from posts.seo_title column", titleMismatch.length, titleMismatch.map((r) => r.slug));

  const nullContentType = (await sql`SELECT id, slug, title FROM posts WHERE content_type IS NULL`) as { id: string; slug: string; title: string }[];
  record("posts with NULL content_type", nullContentType.length, nullContentType.map((r) => r.title));
}

async function main() {
  console.log("Data integrity audit — read-only, no writes");
  console.log("Target: live Neon DB via DATABASE_URL\n");

  await layer0SchemaIntrospection();
  await layer1ReverseCompleteness();
  await layer1ContentTypeMismatch();
  await layer1ExamplesHealth();
  await layer1KanjiPublishEligibility();
  await layer1SoftReferences();
  await layer1MetaConsistency();

  const totalIssues = results.reduce((sum, r) => sum + r.count, 0);
  console.log(`\n=== Summary: ${totalIssues} total flagged rows across ${results.filter((r) => r.count > 0).length} checks ===`);

  const md: string[] = [
    `# Data Integrity Audit — ${new Date().toISOString()}`,
    "",
    "Read-only audit against the live Neon database. No writes were made.",
    "",
    `**Total flagged rows: ${totalIssues}** across ${results.filter((r) => r.count > 0).length} of ${results.length} checks.`,
    "",
    "| Check | Count | Note |",
    "|---|---:|---|",
    ...results
      .sort((a, b) => b.count - a.count)
      .map((r) => `| ${r.name} | ${r.count} | ${r.note ?? ""} |`),
    "",
    "## Samples (capped 20 per check)",
    "",
    ...results
      .filter((r) => r.count > 0)
      .map((r) => `### ${r.name}\n\n${(r.sample ?? []).map((s) => `- ${JSON.stringify(s)}`).join("\n")}\n`),
  ];
  writeFileSync("japanesewithavnish.com-audit/findings/data-integrity.md", md.join("\n"), "utf8");
  console.log("\nWritten to japanesewithavnish.com-audit/findings/data-integrity.md");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
