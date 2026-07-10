import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Client } = pg;

const CUMULATIVE_TARGETS = {
  N5: 100,
  N4: 300,
  N3: 650,
  N2: 1000,
  N1: 2000,
};

const LEVELS = ["N5", "N4", "N3", "N2", "N1"];
const JLPT_NUMBER_TO_LEVEL = {
  5: "N5",
  4: "N4",
  3: "N3",
  2: "N2",
  1: "N1",
};

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, "").split("=");
    return [key, value ?? "true"];
  })
);

const apply = args.get("apply") === "true";
const confirmed = args.get("confirm") === "SEED_KANJI_COVERAGE";
const status = args.get("status") || "draft";

if (!["draft", "published"].includes(status)) {
  console.error("Invalid --status. Use draft or published.");
  process.exit(1);
}

if (apply && !confirmed) {
  console.error("Refusing to seed without --confirm=SEED_KANJI_COVERAGE.");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

function exactTargets() {
  const targets = {};
  let previous = 0;
  for (const level of LEVELS) {
    targets[level] = CUMULATIVE_TARGETS[level] - previous;
    previous = CUMULATIVE_TARGETS[level];
  }
  return targets;
}

function sortByLearnerPriority(a, b) {
  const gradeA = a.grade ?? 99;
  const gradeB = b.grade ?? 99;
  if (gradeA !== gradeB) return gradeA - gradeB;

  const freqA = a.freq_mainichi_shinbun ?? 999999;
  const freqB = b.freq_mainichi_shinbun ?? 999999;
  if (freqA !== freqB) return freqA - freqB;

  return (a.stroke_count ?? 99) - (b.stroke_count ?? 99);
}

function slugFor(entry, level) {
  return `kanji-${level.toLowerCase()}-${entry.kanji.codePointAt(0).toString(16).toLowerCase()}`;
}

function titleFor(entry) {
  const meaning = Array.isArray(entry.meanings) && entry.meanings.length ? ` - ${entry.meanings[0]}` : "";
  return `${entry.kanji}${meaning}`;
}

function contentFor(entry, level, estimated) {
  const meanings = (entry.meanings || []).join(", ") || "review meaning in context";
  const onyomi = (entry.on_readings || []).join(", ") || "none listed";
  const kunyomi = (entry.kun_readings || []).join(", ") || "none listed";
  const strokeCount = entry.stroke_count ? `${entry.stroke_count}` : "review";
  const estimateNote = estimated
    ? "\n\n> Review note: this character was added as a common learner-priority fallback to fill the current coverage target."
    : "";

  return [
    `# ${entry.kanji}`,
    "",
    `## Learning Goal`,
    `Recognize ${entry.kanji} as a ${level} kanji draft, understand its core meaning, and prepare it for lesson review.`,
    "",
    `## Core Meaning`,
    `${entry.kanji} commonly means: ${meanings}.`,
    "",
    `## Readings`,
    `- On-yomi: ${onyomi}`,
    `- Kun-yomi: ${kunyomi}`,
    "",
    `## Writing Focus`,
    `Stroke count: ${strokeCount}. Write it slowly first, then read it inside short vocabulary examples before using it in a full sentence.`,
    "",
    `## Quick Practice`,
    `1. Say the main meaning aloud.`,
    `2. Copy the kanji five times with clear stroke order.`,
    `3. Add one vocabulary word that uses this kanji to your review queue.`,
    "",
    `## Next Step`,
    `An admin should connect this kanji to the correct vocabulary, examples, and curriculum lesson before publishing.${estimateNote}`,
  ].join("\n");
}

const kanjiPath = path.join(process.cwd(), "src/data/kanji_jlpt_only.json");
const raw = JSON.parse(fs.readFileSync(kanjiPath, "utf8"));
const sourceEntries = Object.values(raw)
  .filter((entry) => entry && entry.kanji)
  .map((entry) => ({
    ...entry,
    sourceLevel: JLPT_NUMBER_TO_LEVEL[entry.jlpt],
  }))
  .sort(sortByLearnerPriority);

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function existingCharactersFor(level) {
  const { rows } = await client.query(
    `
      SELECT DISTINCT k.character
      FROM kanji k
      LEFT JOIN posts p ON p.id = k.post_id
      WHERE k.character IS NOT NULL
        AND (
          k.jlpt_level = $1
          OR EXISTS (
            SELECT 1
            FROM unnest(coalesce(p.jlpt_level, '{}'::text[])) AS post_level(level_code)
            WHERE post_level.level_code = $1
          )
        )
    `,
    [level]
  );
  return new Set(rows.map((row) => row.character));
}

async function allExistingCharacters() {
  const { rows } = await client.query(`SELECT DISTINCT character FROM kanji WHERE character IS NOT NULL`);
  return new Set(rows.map((row) => row.character));
}

function rowForInsert(entry, level, estimated) {
  const meaning = (entry.meanings || []).join("; ");
  return {
    slug: slugFor(entry, level),
    title: titleFor(entry),
    summary: `Kanji draft for ${entry.kanji}: ${meaning || "meaning review"}.`,
    content: contentFor(entry, level, estimated),
    level,
    status,
    meta: {
      source: "src/data/kanji_jlpt_only.json",
      seed_reason: "coverage_target",
      estimated_level: estimated,
      original_jlpt: entry.jlpt,
      grade: entry.grade ?? null,
      unicode: entry.unicode ?? null,
    },
    character: entry.kanji,
    onyomi: entry.on_readings || [],
    kunyomi: entry.kun_readings || [],
    stroke_count: entry.stroke_count || null,
    meaning,
    notes: "Draft coverage row. Review examples, vocabulary links, and lesson placement before publishing.",
  };
}

async function insertKanjiBatch(rows) {
  if (!rows.length) return;
  await client.query(
    `
      WITH input AS (
        SELECT *
        FROM jsonb_to_recordset($1::jsonb) AS row_data(
          slug text,
          title text,
          summary text,
          content text,
          level text,
          status text,
          meta jsonb,
          character text,
          onyomi jsonb,
          kunyomi jsonb,
          stroke_count int,
          meaning text,
          notes text
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
          ARRAY['kanji', level]::text[],
          status,
          CASE WHEN status = 'published' THEN now() ELSE NULL END,
          'kanji',
          0,
          meta,
          now(),
          now()
        FROM input
        ON CONFLICT (slug) DO UPDATE
        SET title = EXCLUDED.title,
            summary = EXCLUDED.summary,
            content = EXCLUDED.content,
            jlpt_level = EXCLUDED.jlpt_level,
            tags = EXCLUDED.tags,
            content_type = 'kanji',
            meta = coalesce(posts.meta, '{}'::jsonb) || EXCLUDED.meta,
            updated_at = now()
        RETURNING id, slug
      )
      INSERT INTO kanji (post_id, character, onyomi, kunyomi, stroke_count, meaning, notes, jlpt_level, created_at, updated_at)
      SELECT
        upserted_posts.id,
        input.character,
        ARRAY(SELECT jsonb_array_elements_text(input.onyomi))::text[],
        ARRAY(SELECT jsonb_array_elements_text(input.kunyomi))::text[],
        input.stroke_count,
        input.meaning,
        input.notes,
        input.level,
        now(),
        now()
      FROM input
      JOIN upserted_posts ON upserted_posts.slug = input.slug
      ON CONFLICT (post_id) DO UPDATE
      SET character = EXCLUDED.character,
          onyomi = EXCLUDED.onyomi,
          kunyomi = EXCLUDED.kunyomi,
          stroke_count = EXCLUDED.stroke_count,
          meaning = EXCLUDED.meaning,
          notes = EXCLUDED.notes,
          jlpt_level = EXCLUDED.jlpt_level,
          updated_at = now()
    `,
    [JSON.stringify(rows)]
  );
}

await client.connect();
try {
  const targets = exactTargets();
  const existingAll = await allExistingCharacters();
  const plan = [];

  for (const level of LEVELS) {
    const existingForLevel = await existingCharactersFor(level);
    const needed = Math.max(0, targets[level] - existingForLevel.size);
    if (needed === 0) {
      plan.push({ level, existing: existingForLevel.size, needed, selected: [] });
      continue;
    }

    const primary = sourceEntries.filter((entry) => entry.sourceLevel === level && !existingAll.has(entry.kanji));
    const fallback = sourceEntries.filter((entry) => entry.sourceLevel !== level && !existingAll.has(entry.kanji));
    const selected = [...primary, ...fallback].slice(0, needed).map((entry) => ({
      ...entry,
      estimated: entry.sourceLevel !== level,
    }));

    selected.forEach((entry) => existingAll.add(entry.kanji));
    plan.push({ level, existing: existingForLevel.size, needed, selected });
  }

  for (const row of plan) {
    console.log(`${row.level}: existing exact ${row.existing}/${targets[row.level]}, needs ${row.needed}, selected ${row.selected.length}`);
    const estimated = row.selected.filter((entry) => entry.estimated).length;
    if (estimated) console.log(`  ${estimated} selected as learner-priority fallback drafts`);
  }

  if (!apply) {
    console.log("\nDry run only. Add --apply --confirm=SEED_KANJI_COVERAGE to insert draft kanji rows.");
    process.exit(0);
  }

  await client.query("BEGIN");
  try {
    const rows = plan.flatMap((row) => row.selected.map((entry) => rowForInsert(entry, row.level, entry.estimated)));
    const batchSize = 250;
    for (let i = 0; i < rows.length; i += batchSize) {
      await insertKanjiBatch(rows.slice(i, i + batchSize));
      console.log(`Inserted ${Math.min(i + batchSize, rows.length)} / ${rows.length}`);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  }

  console.log("\nKanji coverage seed complete.");
} finally {
  await client.end();
}
