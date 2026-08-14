import "dotenv/config";
import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import pg from "pg";

const { Client } = pg;

const SOURCE_URL = "https://www.kanshudo.com/collections/jlpt_kanji";
const KANSHUDO_COUNTS = {
  N5: 80,
  N4: 170,
  N3: 370,
  N2: 380,
  N1: 1136,
};

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, "").split("=");
    return [key, value ?? "true"];
  })
);

const apply = args.get("apply") === "true";
const confirmed = args.get("confirm") === "IMPORT_KANSHUDO_KANJI";
const status = args.get("status") || "published";
const fetchMissingDetails = args.get("fetch-missing-details") !== "false";

if (!["draft", "published"].includes(status)) {
  console.error("Invalid --status. Use draft or published.");
  process.exit(1);
}

if (apply && !confirmed) {
  console.error("Refusing to import without --confirm=IMPORT_KANSHUDO_KANJI.");
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
            "user-agent": "JapaneseWithAvnishContentImporter/1.0",
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
    .trim();
}

function stripTags(input) {
  return decodeHtml(
    input
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s+/g, "\n")
      .trim()
  );
}

function parseKanshudoList(html) {
  const rows = [];
  const sectionRegex = /<h4>JLPT Kanji (N[1-5])[\s\S]*?<\/h4>([\s\S]*?)(?=<h4>JLPT Kanji N[1-5]|<footer|$)/g;
  let sectionMatch;
  while ((sectionMatch = sectionRegex.exec(html))) {
    const level = sectionMatch[1];
    const sectionHtml = sectionMatch[2];
    const kanjiRegex = /<span class=['"]kanji['"]>\s*<a href=['"]\/kanji\/[^'"]+['"]>([^<]+)<\/a>\s*<\/span>/g;
    let kanjiMatch;
    while ((kanjiMatch = kanjiRegex.exec(sectionHtml))) {
      const character = decodeHtml(kanjiMatch[1]).trim();
      if (/^\p{Script=Han}$/u.test(character)) {
        rows.push({
          character,
          level,
          sourceUrl: `${SOURCE_URL}#${level.toLowerCase()}`,
          detailUrl: `https://www.kanshudo.com/kanji/${encodeURIComponent(character)}`,
        });
      }
    }
  }
  return rows;
}

function exactCounts(rows) {
  return rows.reduce((acc, row) => {
    acc[row.level] = (acc[row.level] || 0) + 1;
    return acc;
  }, {});
}

function slugFor(character, level) {
  return `kanji-${level.toLowerCase()}-${character.codePointAt(0).toString(16).toLowerCase()}`;
}

function detailFor(character, localEntry = {}) {
  const meanings = Array.isArray(localEntry.meanings) ? localEntry.meanings.filter(Boolean) : [];
  const onyomi = Array.isArray(localEntry.on_readings) ? localEntry.on_readings.filter(Boolean) : [];
  const kunyomi = Array.isArray(localEntry.kun_readings) ? localEntry.kun_readings.filter(Boolean) : [];
  const nameReadings = Array.isArray(localEntry.name_readings) ? localEntry.name_readings.filter(Boolean) : [];

  return {
    meanings,
    meaning: meanings.join("; ") || "meaning review needed",
    onyomi,
    kunyomi,
    nameReadings,
    strokeCount: Number.isFinite(localEntry.stroke_count) ? localEntry.stroke_count : null,
    frequency: Number.isFinite(localEntry.freq_mainichi_shinbun) ? localEntry.freq_mainichi_shinbun : null,
    grade: Number.isFinite(localEntry.grade) ? localEntry.grade : null,
    unicode: localEntry.unicode || character.codePointAt(0).toString(16).toUpperCase(),
  };
}

function parseKanshudoDetail(character, html) {
  const metaDescription =
    html.match(/<meta name=["']description["'] content=["']([^"']+)["']/i)?.[1] ||
    html.match(/<meta property=["']og:description["'] content=["']([^"']+)["']/i)?.[1] ||
    "";
  const decodedMeta = decodeHtml(metaDescription);
  const text = stripTags(html);

  const meaning =
    decodedMeta.match(new RegExp(`${character} is a Japanese kanji that means ([^.]+)\\.`))?.[1]?.trim() ||
    text.match(new RegExp(`${character}\\s+means\\s+'([^']+)'`))?.[1]?.trim() ||
    "";
  const strokeCount =
    Number(decodedMeta.match(new RegExp(`${character} has ([0-9]+) strokes`))?.[1]) ||
    Number(text.match(/Strokes\s*:?\s*([0-9]+)/i)?.[1]) ||
    null;
  const frequency =
    Number(decodedMeta.match(/is the ([0-9,]+)(?:st|nd|rd|th) most common kanji/i)?.[1]?.replace(/,/g, "")) ||
    Number(text.match(/Frequency:\s*([0-9,]+)/i)?.[1]?.replace(/,/g, "")) ||
    null;
  const grade = Number(text.match(/Grade:\s*([0-9]+)/i)?.[1]) || null;

  let onyomi = [];
  let kunyomi = [];
  const firstMeaning = meaning.split(/[;,]/)[0]?.trim();
  if (firstMeaning) {
    const escapedMeaning = firstMeaning.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const cascade = text.match(new RegExp(`Cascading kanji view[\\s\\S]*?${character}\\s+([ァ-ヴー\\s]+)?([ぁ-んー.\\s]+)?\\s+${escapedMeaning}`, "u"));
    if (cascade?.[1]) {
      onyomi = cascade[1].trim().split(/\s+/).filter(Boolean);
    }
    if (cascade?.[2]) {
      kunyomi = cascade[2].trim().split(/\s+/).filter(Boolean);
    }
  }

  return {
    meanings: meaning ? meaning.split(/;\s*|,\s*/).filter(Boolean) : [],
    on_readings: onyomi,
    kun_readings: kunyomi,
    name_readings: [],
    stroke_count: strokeCount,
    freq_mainichi_shinbun: frequency,
    grade,
    unicode: character.codePointAt(0).toString(16).toUpperCase(),
  };
}

async function hydrateMissingDetails(rows, localMap) {
  const missingRows = rows.filter((row) => !localMap.has(row.character));
  if (!fetchMissingDetails || !missingRows.length) return { fetched: 0, failed: 0 };

  let fetched = 0;
  let failed = 0;
  for (const row of missingRows) {
    try {
      const html = await fetchHtml(row.detailUrl);
      localMap.set(row.character, parseKanshudoDetail(row.character, html));
      fetched += 1;
      if (fetched % 25 === 0) {
        console.log(`Fetched fallback details for ${fetched} / ${missingRows.length}`);
      }
    } catch (error) {
      failed += 1;
      console.warn(`Failed fallback detail fetch for ${row.character}: ${error.message}`);
    }
  }
  return { fetched, failed };
}

function contentFor(row) {
  const meanings = row.meanings.length ? row.meanings.join(", ") : "review meaning in context";
  const onyomi = row.onyomi.length ? row.onyomi.join(", ") : "none listed";
  const kunyomi = row.kunyomi.length ? row.kunyomi.join(", ") : "none listed";
  const nameReadings = row.nameReadings.length ? row.nameReadings.slice(0, 8).join(", ") : "none listed";
  const strokeCount = row.strokeCount ? `${row.strokeCount}` : "review";
  const frequency = row.frequency ? `${row.frequency}` : "not listed";
  const grade = row.grade ? `${row.grade}` : "not listed";

  return [
    `# ${row.character}`,
    "",
    "## Core Meaning",
    `${row.character} commonly means: ${meanings}.`,
    "",
    "## JLPT Placement",
    `${row.character} is listed in the Kanshudo ${row.level} kanji collection.`,
    "",
    "## Readings",
    `- On-yomi: ${onyomi}`,
    `- Kun-yomi: ${kunyomi}`,
    `- Name readings: ${nameReadings}`,
    "",
    "## Writing And Recognition",
    `- Stroke count: ${strokeCount}`,
    `- Frequency rank: ${frequency}`,
    `- School grade: ${grade}`,
    "",
    "## How To Study This Kanji",
    `First connect ${row.character} with the core meaning "${row.meanings[0] || "review"}". Then say the common readings aloud and write the kanji slowly while checking the stroke count.`,
    "",
    "## Quick Practice",
    `1. Meaning recall: What does ${row.character} mean?`,
    `2. Reading recall: Say one on-yomi and one kun-yomi if listed.`,
    `3. Vocabulary link: Find one word in your lessons that uses ${row.character}.`,
    "",
    "## Admin Review Note",
    "This entry was aligned to the public Kanshudo JLPT kanji collection and enriched with local dictionary readings, stroke count, frequency, and learner-facing study guidance.",
  ].join("\n");
}

function dbRow(row, localMap) {
  const detail = detailFor(row.character, localMap.get(row.character));
  const slug = slugFor(row.character, row.level);
  return {
    ...row,
    ...detail,
    slug,
    title: `${row.character} - ${detail.meanings[0] || "kanji"}`,
    summary: `${row.level} kanji: ${row.character} means ${detail.meaning}.`,
    content: contentFor({ ...row, ...detail }),
    status,
    meta: {
      source: "kanshudo_jlpt_kanji",
      source_url: SOURCE_URL,
      kanshudo_detail_url: row.detailUrl,
      kanshudo_jlpt_level: row.level,
      readings_source: "src/data/kanji_jlpt_only.json",
      unicode: detail.unicode,
      frequency_rank: detail.frequency,
      grade: detail.grade,
    },
    notes: "Aligned to Kanshudo JLPT kanji collection. Details enriched from local dictionary data.",
  };
}

async function upsertBatch(client, rows) {
  if (!rows.length) return { inserted: 0, updated: 0 };
  const result = await client.query(
    `
      WITH input AS (
        SELECT *
        FROM jsonb_to_recordset($1::jsonb) AS row_data(
          character text,
          level text,
          sourceUrl text,
          detailUrl text,
          meanings jsonb,
          meaning text,
          onyomi jsonb,
          kunyomi jsonb,
          nameReadings jsonb,
          strokeCount int,
          frequency int,
          grade int,
          unicode text,
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
        SELECT input.*, k.id AS kanji_id, k.post_id
        FROM input
        JOIN kanji k ON k.character = input.character
      ),
      updated_kanji AS (
        UPDATE kanji k
        SET onyomi = CASE
              WHEN cardinality(coalesce(k.onyomi, '{}'::text[])) = 0 THEN ARRAY(SELECT jsonb_array_elements_text(existing.onyomi))::text[]
              ELSE k.onyomi
            END,
            kunyomi = CASE
              WHEN cardinality(coalesce(k.kunyomi, '{}'::text[])) = 0 THEN ARRAY(SELECT jsonb_array_elements_text(existing.kunyomi))::text[]
              ELSE k.kunyomi
            END,
            stroke_count = coalesce(k.stroke_count, existing.strokeCount),
            meaning = CASE
              WHEN length(coalesce(k.meaning, '')) < length(coalesce(existing.meaning, '')) THEN existing.meaning
              ELSE k.meaning
            END,
            notes = CASE
              WHEN coalesce(k.notes, '') LIKE '%Kanshudo JLPT kanji collection%' THEN k.notes
              ELSE concat_ws(E'\\n\\n', nullif(k.notes, ''), existing.notes)
            END,
            jlpt_level = existing.level,
            updated_at = now()
        FROM existing
        WHERE k.id = existing.kanji_id
        RETURNING k.id
      ),
      updated_posts AS (
        UPDATE posts p
        SET title = CASE WHEN p.title IS NULL OR p.title = '' OR p.title = existing.character THEN existing.title ELSE p.title END,
            summary = CASE WHEN p.summary IS NULL OR length(p.summary) < 40 THEN existing.summary ELSE p.summary END,
            content = CASE
              WHEN length(coalesce(p.content, '')) < 700 OR p.meta->>'seed_reason' = 'coverage_target' THEN existing.content
              ELSE p.content
            END,
            jlpt_level = ARRAY[existing.level]::text[],
            tags = ARRAY['kanji', existing.level]::text[],
            content_type = 'kanji',
            meta = coalesce(p.meta, '{}'::jsonb) || existing.meta,
            updated_at = now()
        FROM existing
        WHERE p.id = existing.post_id
        RETURNING p.id
      ),
      new_input AS (
        SELECT input.*
        FROM input
        WHERE NOT EXISTS (SELECT 1 FROM kanji k WHERE k.character = input.character)
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
          ARRAY['kanji', level]::text[],
          status,
          CASE WHEN status = 'published' THEN now() ELSE NULL END,
          'kanji',
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
            content_type = 'kanji',
            meta = coalesce(posts.meta, '{}'::jsonb) || EXCLUDED.meta,
            updated_at = now()
        RETURNING id, slug
      ),
      inserted_kanji AS (
        INSERT INTO kanji (post_id, character, onyomi, kunyomi, stroke_count, meaning, notes, jlpt_level, created_at, updated_at)
        SELECT
          upserted_posts.id,
          new_input.character,
          ARRAY(SELECT jsonb_array_elements_text(new_input.onyomi))::text[],
          ARRAY(SELECT jsonb_array_elements_text(new_input.kunyomi))::text[],
          new_input.strokeCount,
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
        (SELECT COUNT(*)::int FROM inserted_kanji) AS inserted,
        (SELECT COUNT(*)::int FROM updated_kanji) AS updated
    `,
    [JSON.stringify(rows)]
  );

  return {
    inserted: Number(result.rows[0]?.inserted || 0),
    updated: Number(result.rows[0]?.updated || 0),
  };
}

const localKanjiPath = path.join(process.cwd(), "src/data/kanji_jlpt_only.json");
const localRaw = JSON.parse(fs.readFileSync(localKanjiPath, "utf8"));
const localMap = new Map(Object.values(localRaw).filter((entry) => entry?.kanji).map((entry) => [entry.kanji, entry]));

const html = await fetchHtml(SOURCE_URL);
const parsedRows = parseKanshudoList(html);
const uniqueRows = [];
const seen = new Set();
for (const row of parsedRows) {
  if (seen.has(row.character)) continue;
  seen.add(row.character);
  uniqueRows.push(row);
}

const counts = exactCounts(uniqueRows);
console.log(`Parsed ${uniqueRows.length} unique Kanshudo JLPT kanji.`);
for (const level of ["N5", "N4", "N3", "N2", "N1"]) {
  console.log(`${level}: ${counts[level] || 0}/${KANSHUDO_COUNTS[level]}`);
}
const missingLocalDetails = uniqueRows.filter((row) => !localMap.has(row.character));
console.log(`Kanji missing local dictionary details: ${missingLocalDetails.length}`);
if (missingLocalDetails.length) {
  console.log(missingLocalDetails.slice(0, 30).map((row) => `${row.character}(${row.level})`).join(" "));
}
const fallbackResult = await hydrateMissingDetails(uniqueRows, localMap);
if (fallbackResult.fetched || fallbackResult.failed) {
  console.log(`Fallback Kanshudo detail fetch: ${fallbackResult.fetched} fetched, ${fallbackResult.failed} failed.`);
}

if (!apply) {
  console.log("Dry run only. Add --apply --confirm=IMPORT_KANSHUDO_KANJI to write rows.");
  process.exit(0);
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  let inserted = 0;
  let updated = 0;
  await client.query("BEGIN");
  try {
    const rows = uniqueRows.map((row) => dbRow(row, localMap));
    const batchSize = 250;
    for (let i = 0; i < rows.length; i += batchSize) {
      const result = await upsertBatch(client, rows.slice(i, i + batchSize));
      inserted += result.inserted;
      updated += result.updated;
      console.log(`Processed ${Math.min(i + batchSize, rows.length)} / ${rows.length}`);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  console.log(`Import complete. Inserted ${inserted}, updated ${updated}.`);
} finally {
  await client.end();
}
