import "dotenv/config";
import pg from "pg";

const { Client } = pg;

// One-time backfill for Phase 1 of the admin content-editor overhaul: moves
// posts.meta.examples (array of {japanese, romaji, translation}, written by
// the old generic editor) into real rows in the `examples` table, scoped to
// the vocabulary/grammar/kanji sidecar row's own id — so the new dedicated
// editors' Examples CRUD section shows existing content instead of appearing
// empty. Idempotent: skips any item that already has >=1 examples row (either
// backfilled already, or added manually via the new editor).
//
// Does NOT delete meta.examples — the public read path falls back to it for
// any item not yet backfilled/re-saved (see LessonMetaContent.tsx).

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, "").split("=");
    return [key, value ?? "true"];
  })
);
const dryRun = args.get("apply") !== "true";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const client = new Client({ connectionString: process.env.DATABASE_URL });

const SIDECAR = {
  vocabulary: { table: "vocabulary", fkColumn: "vocabulary_id" },
  grammar: { table: "grammar", fkColumn: "grammar_id" },
  kanji: { table: "kanji", fkColumn: "kanji_id" },
};

async function backfillType(contentType) {
  const { table, fkColumn } = SIDECAR[contentType];
  const { rows } = await client.query(
    `
      SELECT s.id AS sidecar_id, p.id AS post_id, p.slug, p.meta
      FROM posts p
      JOIN ${table} s ON s.post_id = p.id
      WHERE p.content_type = $1
        AND p.meta ? 'examples'
        AND jsonb_typeof(p.meta->'examples') = 'array'
        AND jsonb_array_length(p.meta->'examples') > 0
        AND NOT EXISTS (SELECT 1 FROM examples e WHERE e.${fkColumn} = s.id)
    `,
    [contentType]
  );

  console.log(`\n${contentType}: ${rows.length} item(s) with meta.examples and no existing examples rows${dryRun ? " (dry run)" : ""}`);

  let inserted = 0;
  for (const row of rows) {
    const items = Array.isArray(row.meta?.examples) ? row.meta.examples : [];
    // examples.sentence_en is NOT NULL — skip items missing a translation rather than writing empty strings.
    const valid = items.filter(
      (it) =>
        it &&
        typeof it === "object" &&
        typeof it.japanese === "string" &&
        it.japanese.trim() &&
        typeof it.translation === "string" &&
        it.translation.trim()
    );
    if (!valid.length) continue;
    console.log(`  - ${row.slug}: ${valid.length} example(s)`);
    if (dryRun) {
      inserted += valid.length;
      continue;
    }
    for (const [i, it] of valid.entries()) {
      await client.query(
        `INSERT INTO examples (${fkColumn}, sentence_ja, sentence_romaji, sentence_en, sort_order)
         VALUES ($1, $2, $3, $4, $5)`,
        [row.sidecar_id, it.japanese.trim(), it.romaji ? String(it.romaji).trim() : null, it.translation.trim(), i]
      );
      inserted++;
    }
  }
  console.log(`  ${dryRun ? "Would insert" : "Inserted"} ${inserted} example row(s) for ${contentType}.`);
}

await client.connect();
try {
  for (const type of Object.keys(SIDECAR)) {
    await backfillType(type);
  }
  if (dryRun) {
    console.log("\nDry run only. Add --apply=true to write.");
  }
} finally {
  await client.end();
}
