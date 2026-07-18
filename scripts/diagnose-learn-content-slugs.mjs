import "dotenv/config";
import pg from "pg";

const { Client } = pg;

// Read-only diagnostic for the admin "Edit" 404 seen specifically on Vocabulary
// (not Grammar/Kanji, which use ASCII-only slugs). Vocabulary slugs are generated
// by slugifyVocab() in scripts/import-nihongoichiban-n5-n4-vocab.mjs and
// scripts/import-japanesetest4you-n3-n2-n1-vocab.mjs using a Unicode-aware
// \p{L}\p{N} regex that keeps raw Japanese characters in the slug — this script
// checks for the encoding/normalization/orphan issues that plausibly causes.
// Makes no writes. See docs/regression-test/ for how findings were remediated.

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const client = new Client({ connectionString: process.env.DATABASE_URL });

function printRows(label, rows) {
  console.log(`\n${label}: ${rows.length} row(s)`);
  for (const row of rows) {
    console.log(`  ${JSON.stringify(row)}`);
  }
}

async function main() {
  // A. Duplicate posts.slug values (should be 0 — slug is TEXT UNIQUE NOT NULL)
  const dupSlugs = await client.query(`
    SELECT slug, COUNT(*)::int AS count
    FROM posts
    GROUP BY slug
    HAVING COUNT(*) > 1
    ORDER BY count DESC
  `);
  printRows("A. Duplicate posts.slug", dupSlugs.rows);

  // B. Orphaned sidecar rows (post_id doesn't resolve to any posts row)
  const orphans = await client.query(`
    SELECT 'vocabulary' AS kind, v.id, v.post_id FROM vocabulary v LEFT JOIN posts p ON p.id = v.post_id WHERE p.id IS NULL
    UNION ALL
    SELECT 'grammar', g.id, g.post_id FROM grammar g LEFT JOIN posts p ON p.id = g.post_id WHERE p.id IS NULL
    UNION ALL
    SELECT 'kanji', k.id, k.post_id FROM kanji k LEFT JOIN posts p ON p.id = k.post_id WHERE p.id IS NULL
  `);
  printRows("B. Orphaned sidecar rows (no matching posts row)", orphans.rows);

  // C. Sidecar rows whose post's content_type has drifted
  const drifted = await client.query(`
    SELECT 'vocabulary' AS kind, v.id, v.post_id, p.slug, p.content_type
    FROM vocabulary v JOIN posts p ON p.id = v.post_id
    WHERE p.content_type IS DISTINCT FROM 'vocabulary'
    UNION ALL
    SELECT 'grammar', g.id, g.post_id, p.slug, p.content_type
    FROM grammar g JOIN posts p ON p.id = g.post_id
    WHERE p.content_type IS DISTINCT FROM 'grammar'
    UNION ALL
    SELECT 'kanji', k.id, k.post_id, p.slug, p.content_type
    FROM kanji k JOIN posts p ON p.id = k.post_id
    WHERE p.content_type IS DISTINCT FROM 'kanji'
  `);
  printRows("C. Sidecar rows with content_type drift", drifted.rows);

  // D. Non-ASCII / malformed vocabulary slugs specifically
  const badSlugs = await client.query(`
    SELECT p.id, p.slug, v.word, v.reading, v.romaji,
           (p.slug <> normalize(p.slug, NFKC)) AS not_nfkc_normalized,
           (p.slug ~ '[\\s?#%]') AS has_unsafe_chars,
           (trim(p.slug) = '') AS is_blank
    FROM posts p
    JOIN vocabulary v ON v.post_id = p.id
    WHERE p.content_type = 'vocabulary'
      AND (
        trim(p.slug) = ''
        OR p.slug ~ '[\\s?#%]'
        OR p.slug <> normalize(p.slug, NFKC)
      )
    LIMIT 200
  `);
  printRows("D. Non-ASCII / malformed vocabulary slugs", badSlugs.rows);

  // D2. All vocabulary slugs containing non-ASCII bytes (informational — not
  // necessarily broken, but the population most at risk per the root-cause hypothesis)
  const nonAsciiCount = await client.query(`
    SELECT COUNT(*)::int AS count
    FROM posts p
    JOIN vocabulary v ON v.post_id = p.id
    WHERE p.content_type = 'vocabulary' AND p.slug ~ '[^\\x00-\\x7F]'
  `);
  console.log(`\nD2. Vocabulary slugs containing non-ASCII characters: ${nonAsciiCount.rows[0].count}`);

  // E. Stale learning_content_migration_map entries (if that table still exists)
  const mapTableExists = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_name = 'learning_content_migration_map'
    ) AS exists
  `);
  if (mapTableExists.rows[0].exists) {
    const staleMap = await client.query(`
      SELECT m.*
      FROM learning_content_migration_map m
      LEFT JOIN posts p ON p.id = m.new_post_id
      WHERE m.content_type = 'vocabulary' AND p.id IS NULL
      LIMIT 200
    `);
    printRows("E. Stale learning_content_migration_map entries (vocabulary)", staleMap.rows);
  } else {
    console.log("\nE. learning_content_migration_map table does not exist — skipped.");
  }

  // F. Total vocabulary count, for context
  const total = await client.query(`SELECT COUNT(*)::int AS count FROM posts WHERE content_type = 'vocabulary'`);
  console.log(`\nF. Total vocabulary posts: ${total.rows[0].count}`);
}

await client.connect();
try {
  await main();
} finally {
  await client.end();
}
