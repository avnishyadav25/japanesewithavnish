import "dotenv/config";
import https from "node:https";
import pg from "pg";

const { Client } = pg;

const SOURCES = [
  {
    level: "N5",
    url: "https://nihongoichiban.com/2011/04/30/complete-list-of-vocabulary-for-the-jlpt-n5/",
  },
  {
    level: "N4",
    url: "https://nihongoichiban.com/2012/06/15/complete-list-of-vocabulary-for-the-jlpt-n4/",
  },
];

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, "").split("=");
    return [key, value ?? "true"];
  })
);

const apply = args.get("apply") === "true";
const confirmed = args.get("confirm") === "IMPORT_N5_N4_VOCAB";
const status = args.get("status") || "published";

if (!["draft", "published"].includes(status)) {
  console.error("Invalid --status. Use draft or published.");
  process.exit(1);
}

if (apply && !confirmed) {
  console.error("Refusing to import without --confirm=IMPORT_N5_N4_VOCAB.");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            "user-agent": "JapaneseWithAvnishContentAudit/1.0",
            accept: "text/html",
          },
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            resolve(fetchHtml(new URL(res.headers.location, url).toString()));
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`Fetch failed ${res.statusCode} for ${url}`));
            res.resume();
            return;
          }
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            body += chunk;
          });
          res.on("end", () => resolve(body));
        }
      )
      .on("error", reject);
  });
}

function decodeHtml(input) {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-fA-F0-9]+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(input) {
  return decodeHtml(input.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, ""));
}

function parseVocabularyRows(html, level, sourceUrl) {
  const rows = [];
  const tableMatches = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  for (const table of tableMatches) {
    if (!/Romaji/i.test(table) || !/Meaning/i.test(table)) continue;
    const trMatches = table.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    for (const tr of trMatches) {
      const cells = [...tr.matchAll(/<td[\s\S]*?>([\s\S]*?)<\/td>/gi)].map((match) => stripTags(match[1]));
      if (cells.length < 4) continue;
      const [kanjiRaw, readingRaw, romajiRaw, meaningRaw] = cells;
      if (/kanji/i.test(kanjiRaw) || /furigana/i.test(readingRaw) || /romaji/i.test(romajiRaw)) continue;

      const reading = readingRaw.trim();
      const word = (kanjiRaw.trim() || reading).trim();
      const romaji = romajiRaw.trim();
      const meaning = meaningRaw.trim();

      if (!word || !meaning || !romaji) continue;
      rows.push({
        level,
        word,
        reading,
        romaji,
        meaning,
        sourceUrl,
      });
    }
  }
  return rows;
}

function slugifyVocab(level, word, reading) {
  const base = `${word || reading}-${reading || word}`
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[〜~]/g, "prefix-")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `vocabulary-${level.toLowerCase()}-${base || Math.random().toString(36).slice(2)}`;
}

function contentFor(row) {
  return [
    `# ${row.word}`,
    "",
    "## Quick Meaning",
    `${row.word} means "${row.meaning}".`,
    "",
    "## Reading",
    `- Furigana: ${row.reading || row.word}`,
    `- Romaji: ${row.romaji}`,
    "",
    "## How To Study This Word",
    `Read the word aloud, cover the English meaning, and recall "${row.meaning}" from the Japanese form. Then write one short sentence using ${row.word}.`,
    "",
    "## Mini Practice",
    `1. Japanese to English: ${row.word}`,
    `2. Reading check: ${row.reading || row.word}`,
    `3. Romaji check: ${row.romaji}`,
    "",
    "## Next Step",
    "Add this word to your review queue and revisit it inside a real sentence.",
  ].join("\n");
}

function dbRow(row) {
  const slug = slugifyVocab(row.level, row.word, row.reading);
  const meta = {
    japanese: row.word,
    reading: row.reading,
    romaji: row.romaji,
    meaning: row.meaning,
    source: "nihongoichiban",
    source_url: row.sourceUrl,
    imported_levels: [row.level],
  };

  return {
    ...row,
    slug,
    title: `${row.word} (${row.romaji})`,
    summary: `${row.level} vocabulary: ${row.word} means ${row.meaning}.`,
    content: contentFor(row),
    status,
    meta,
    notes: "Imported from N5/N4 vocabulary coverage list.",
  };
}

async function upsertBatch(client, rows) {
  if (!rows.length) return { inserted: 0, updated: 0 };
  const result = await client.query(
    `
      WITH input AS (
        SELECT *
        FROM jsonb_to_recordset($1::jsonb) AS row_data(
          level text,
          word text,
          reading text,
          romaji text,
          meaning text,
          sourceUrl text,
          slug text,
          title text,
          summary text,
          content text,
          status text,
          meta jsonb,
          notes text
        )
      ),
      existing AS (
        SELECT input.*, v.id AS vocabulary_id, v.post_id
        FROM input
        JOIN vocabulary v
          ON lower(trim(v.word)) = lower(trim(input.word))
         AND coalesce(lower(trim(v.reading)), '') = coalesce(lower(trim(input.reading)), '')
      ),
      updated_vocab AS (
        UPDATE vocabulary v
        SET romaji = coalesce(nullif(v.romaji, ''), existing.romaji),
            meaning = coalesce(nullif(v.meaning, ''), existing.meaning),
            jlpt_level = coalesce(v.jlpt_level, existing.level),
            notes = coalesce(nullif(v.notes, ''), existing.notes),
            updated_at = now()
        FROM existing
        WHERE v.id = existing.vocabulary_id
        RETURNING v.id
      ),
      updated_posts AS (
        UPDATE posts p
        SET meta = coalesce(p.meta, '{}'::jsonb) || existing.meta,
            content_type = 'vocabulary',
            updated_at = now()
        FROM existing
        WHERE p.id = existing.post_id
        RETURNING p.id
      ),
      new_input AS (
        SELECT input.*
        FROM input
        WHERE NOT EXISTS (
          SELECT 1
          FROM vocabulary v
          WHERE lower(trim(v.word)) = lower(trim(input.word))
            AND coalesce(lower(trim(v.reading)), '') = coalesce(lower(trim(input.reading)), '')
        )
      ),
      upserted_posts AS (
        INSERT INTO posts (
          slug, title, summary, content, jlpt_level, tags, status, published_at,
          content_type, sort_order, meta, created_at, updated_at
        )
        SELECT
          slug,
          title,
          summary,
          content,
          ARRAY[level]::text[],
          ARRAY['vocabulary', level]::text[],
          status,
          CASE WHEN status = 'published' THEN now() ELSE NULL END,
          'vocabulary',
          0,
          meta,
          now(),
          now()
        FROM new_input
        ON CONFLICT (slug) DO UPDATE
        SET title = EXCLUDED.title,
            summary = EXCLUDED.summary,
            content = EXCLUDED.content,
            jlpt_level = EXCLUDED.jlpt_level,
            tags = EXCLUDED.tags,
            status = EXCLUDED.status,
            content_type = 'vocabulary',
            meta = coalesce(posts.meta, '{}'::jsonb) || EXCLUDED.meta,
            updated_at = now()
        RETURNING id, slug
      ),
      inserted_vocab AS (
        INSERT INTO vocabulary (post_id, word, reading, romaji, meaning, notes, jlpt_level, created_at, updated_at)
        SELECT
          upserted_posts.id,
          new_input.word,
          nullif(new_input.reading, ''),
          new_input.romaji,
          new_input.meaning,
          new_input.notes,
          new_input.level,
          now(),
          now()
        FROM new_input
        JOIN upserted_posts ON upserted_posts.slug = new_input.slug
        ON CONFLICT DO NOTHING
        RETURNING id
      )
      SELECT
        (SELECT COUNT(*)::int FROM inserted_vocab) AS inserted,
        (SELECT COUNT(*)::int FROM updated_vocab) AS updated
    `,
    [JSON.stringify(rows)]
  );

  return {
    inserted: Number(result.rows[0]?.inserted || 0),
    updated: Number(result.rows[0]?.updated || 0),
  };
}

async function findExisting(client, word, reading) {
  const { rows } = await client.query(
    `
      SELECT v.id, v.post_id, v.jlpt_level, p.meta
      FROM vocabulary v
      JOIN posts p ON p.id = v.post_id
      WHERE lower(trim(v.word)) = lower(trim($1))
        AND coalesce(lower(trim(v.reading)), '') = coalesce(lower(trim($2)), '')
      LIMIT 1
    `,
    [word, reading || ""]
  );
  return rows[0] || null;
}

async function updateExisting(client, row, existing) {
  const metaPatch = {
    japanese: row.word,
    reading: row.reading,
    romaji: row.romaji,
    meaning: row.meaning,
    source: "nihongoichiban",
    source_url: row.sourceUrl,
    imported_levels: [row.level],
  };

  await client.query(
    `
      UPDATE vocabulary
      SET romaji = coalesce(nullif(romaji, ''), $1),
          meaning = coalesce(nullif(meaning, ''), $2),
          jlpt_level = coalesce(jlpt_level, $3),
          notes = coalesce(nullif(notes, ''), 'Imported from N5/N4 vocabulary coverage list.'),
          updated_at = now()
      WHERE id = $4
    `,
    [row.romaji, row.meaning, row.level, existing.id]
  );

  await client.query(
    `
      UPDATE posts
      SET meta = coalesce(meta, '{}'::jsonb) || $1::jsonb,
          content_type = 'vocabulary',
          updated_at = now()
      WHERE id = $2
    `,
    [JSON.stringify(metaPatch), existing.post_id]
  );
}

async function insertNew(client, row) {
  const slug = slugifyVocab(row.level, row.word, row.reading);
  const meta = {
    japanese: row.word,
    reading: row.reading,
    romaji: row.romaji,
    meaning: row.meaning,
    source: "nihongoichiban",
    source_url: row.sourceUrl,
    imported_levels: [row.level],
  };

  const { rows: postRows } = await client.query(
    `
      INSERT INTO posts (
        slug, title, summary, content, jlpt_level, tags, status, published_at,
        content_type, sort_order, meta, created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, ARRAY[$5]::text[], ARRAY['vocabulary', $5]::text[],
        $6, CASE WHEN $6 = 'published' THEN now() ELSE NULL END,
        'vocabulary', 0, $7::jsonb, now(), now()
      )
      ON CONFLICT (slug) DO UPDATE
      SET title = EXCLUDED.title,
          summary = EXCLUDED.summary,
          content = EXCLUDED.content,
          jlpt_level = EXCLUDED.jlpt_level,
          tags = EXCLUDED.tags,
          status = EXCLUDED.status,
          content_type = 'vocabulary',
          meta = coalesce(posts.meta, '{}'::jsonb) || EXCLUDED.meta,
          updated_at = now()
      RETURNING id
    `,
    [
      slug,
      `${row.word} (${row.romaji})`,
      `${row.level} vocabulary: ${row.word} means ${row.meaning}.`,
      contentFor(row),
      row.level,
      status,
      JSON.stringify(meta),
    ]
  );

  await client.query(
    `
      INSERT INTO vocabulary (post_id, word, reading, romaji, meaning, notes, jlpt_level, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
      ON CONFLICT DO NOTHING
    `,
    [postRows[0].id, row.word, row.reading || null, row.romaji, row.meaning, "Imported from N5/N4 vocabulary coverage list.", row.level]
  );
}

const client = new Client({ connectionString: process.env.DATABASE_URL });

await client.connect();
try {
  const parsedRows = [];
  for (const source of SOURCES) {
    const html = await fetchHtml(source.url);
    const rows = parseVocabularyRows(html, source.level, source.url);
    console.log(`${source.level}: parsed ${rows.length} rows from ${source.url}`);
    parsedRows.push(...rows);
  }

  const uniqueRows = [];
  const seen = new Set();
  for (const row of parsedRows) {
    const key = `${row.word.trim().toLowerCase()}|${(row.reading || "").trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueRows.push(row);
  }

  console.log(`Unique N5/N4 rows to process: ${uniqueRows.length}`);
  if (!apply) {
    console.log("Dry run only. Add --apply --confirm=IMPORT_N5_N4_VOCAB to write rows.");
    process.exit(0);
  }

  let inserted = 0;
  let updated = 0;

  await client.query("BEGIN");
  try {
    const rows = uniqueRows.map(dbRow);
    const batchSize = 250;
    for (let i = 0; i < rows.length; i += batchSize) {
      const result = await upsertBatch(client, rows.slice(i, i + batchSize));
      inserted += result.inserted;
      updated += result.updated;
      console.log(`Processed ${Math.min(i + batchSize, rows.length)} / ${rows.length}`);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  }

  console.log(`Import complete. Inserted ${inserted}, updated ${updated}.`);
} finally {
  await client.end();
}
