/**
 * Backfill posts.seo_description for vocabulary/kanji/grammar/study_guide posts that have
 * none, using per-type templates built from data already on the row (word/reading/meaning,
 * character/stroke_count, pattern/structure, summary/content). Idempotent: only ever touches
 * rows where seo_description IS NULL — never overwrites an existing value, even a low-quality
 * stub one, so this is always safe to re-run.
 *
 * Run:
 *   npx tsx scripts/backfill-seo-descriptions.ts                       # dry run, all types, published rows
 *   npx tsx scripts/backfill-seo-descriptions.ts --limit=30            # dry run, first 30 per type (pilot preview)
 *   npx tsx scripts/backfill-seo-descriptions.ts --types=vocabulary    # dry run, one type only
 *   npx tsx scripts/backfill-seo-descriptions.ts --status=draft --types=kanji   # dry run, draft kanji only (pre-publish prep)
 *   npx tsx scripts/backfill-seo-descriptions.ts --apply=true          # write, all types, published rows
 *   npx tsx scripts/backfill-seo-descriptions.ts --apply=true --limit=30
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

type ContentType = "vocabulary" | "kanji" | "grammar" | "study_guide";
const ALL_TYPES: ContentType[] = ["vocabulary", "kanji", "grammar", "study_guide"];
const PREVIEW_LINES_PER_TYPE = 25;

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
const typesArg = getArg("types");
const types: ContentType[] = (
  typesArg ? typesArg.split(",").map((s) => s.trim()) : ALL_TYPES
).filter((t): t is ContentType => (ALL_TYPES as string[]).includes(t));
const statusArg = getArg("status");
const status: "published" | "draft" = statusArg === "draft" ? "draft" : "published";

// Mirrors src/lib/seo.ts's clampDescription exactly. Duplicated (not imported) because this
// script runs standalone via tsx and doesn't resolve the Next app's "@/" path aliases.
function clamp(text: string, maxLen = 158): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  const cut = t.slice(0, maxLen - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#*_`>~-]/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function buildVocabDescription(row: {
  word: string;
  reading: string | null;
  meaning: string | null;
  level: string | null;
}): string | null {
  if (!row.meaning?.trim()) return null;
  const reading =
    row.reading?.trim() && row.reading.trim() !== row.word.trim() ? ` (${row.reading.trim()})` : "";
  const levelPart = row.level ? `JLPT ${row.level} word` : "Japanese word";
  return clamp(
    `Learn the ${levelPart} ${row.word}${reading} — "${row.meaning.trim()}". Example sentences, part of speech, and usage.`
  );
}

function buildKanjiDescription(row: {
  character: string;
  meaning: string | null;
  strokeCount: number | null;
  level: string | null;
}): string | null {
  if (!row.meaning?.trim()) return null;
  const levelPart = row.level ? `JLPT ${row.level} kanji` : "Japanese kanji";
  const strokePart = row.strokeCount ? `, ${row.strokeCount} strokes` : "";
  return clamp(
    `The ${levelPart} ${row.character} ("${row.meaning.trim()}"): on/kun readings${strokePart}, stroke order and example words.`
  );
}

function buildGrammarDescription(row: {
  pattern: string;
  meaning: string | null;
  structure: string | null;
  level: string | null;
}): string | null {
  const levelPart = row.level ? `JLPT ${row.level} grammar` : "Japanese grammar";
  const meaningPart = row.meaning?.trim() ? ` — "${row.meaning.trim()}".` : ".";
  const structurePart = row.structure?.trim() ? ` Structure: ${row.structure.trim()}.` : "";
  return clamp(
    `${levelPart} ${row.pattern}${meaningPart}${structurePart} Learn when to use it with example sentences.`
  );
}

function buildStudyGuideDescription(row: {
  summary: string | null;
  content: string | null;
}): string | null {
  const source = row.summary?.trim() || (row.content ? stripMarkdown(row.content) : null);
  if (!source) return null;
  return clamp(source);
}

type Row = { id: string; label: string; description: string | null };

async function runBatch(contentType: ContentType, rows: Row[]) {
  const eligible = rows.filter((r) => r.description);
  const skipped = rows.length - eligible.length;

  console.log(`\n=== ${contentType} ===`);
  console.log(`Candidates (seo_description IS NULL): ${rows.length}`);
  if (skipped > 0) console.log(`Skipped (insufficient data to build a description): ${skipped}`);

  eligible.slice(0, PREVIEW_LINES_PER_TYPE).forEach((r) => {
    console.log(`  - ${r.label}\n      -> ${r.description}`);
  });
  if (eligible.length > PREVIEW_LINES_PER_TYPE) {
    console.log(`  ... and ${eligible.length - PREVIEW_LINES_PER_TYPE} more`);
  }

  if (dryRun) {
    console.log(`Would update ${eligible.length} row(s) in ${contentType}.`);
    return { candidates: rows.length, updated: 0, skipped };
  }

  let updated = 0;
  for (const r of eligible) {
    await sql`
      UPDATE posts SET seo_description = ${r.description}, updated_at = NOW()
      WHERE id = ${r.id} AND seo_description IS NULL
    `;
    updated++;
  }
  console.log(`Updated ${updated} row(s) in ${contentType}.`);
  return { candidates: rows.length, updated, skipped };
}

async function processVocabulary() {
  const rows = (await sql`
    SELECT p.id, v.word, v.reading, v.meaning, COALESCE((p.jlpt_level)[1], v.jlpt_level) AS level
    FROM posts p
    JOIN vocabulary v ON v.post_id = p.id
    WHERE p.status = ${status} AND p.content_type = 'vocabulary' AND p.seo_description IS NULL
    ORDER BY p.created_at
    ${limit ? sql`LIMIT ${limit}` : sql``}
  `) as { id: string; word: string; reading: string | null; meaning: string | null; level: string | null }[];

  return runBatch(
    "vocabulary",
    rows.map((r) => ({
      id: r.id,
      label: `${r.word}${r.level ? ` (${r.level})` : ""}`,
      description: buildVocabDescription(r),
    }))
  );
}

async function processKanji() {
  const rows = (await sql`
    SELECT p.id, k.character, k.meaning, k.stroke_count AS "strokeCount", COALESCE((p.jlpt_level)[1], k.jlpt_level) AS level
    FROM posts p
    JOIN kanji k ON k.post_id = p.id
    WHERE p.status = ${status} AND p.content_type = 'kanji' AND p.seo_description IS NULL
      AND (p.meta->>'merged_into_post_id') IS NULL
    ORDER BY p.created_at
    ${limit ? sql`LIMIT ${limit}` : sql``}
  `) as { id: string; character: string; meaning: string | null; strokeCount: number | null; level: string | null }[];

  return runBatch(
    "kanji",
    rows.map((r) => ({
      id: r.id,
      label: `${r.character}${r.level ? ` (${r.level})` : ""}`,
      description: buildKanjiDescription(r),
    }))
  );
}

async function processGrammar() {
  const rows = (await sql`
    SELECT p.id, g.pattern, g.meaning, g.structure, COALESCE((p.jlpt_level)[1], g.level) AS level
    FROM posts p
    JOIN grammar g ON g.post_id = p.id
    WHERE p.status = ${status} AND p.content_type = 'grammar' AND p.seo_description IS NULL
      AND (p.meta->>'merged_into_post_id') IS NULL
    ORDER BY p.created_at
    ${limit ? sql`LIMIT ${limit}` : sql``}
  `) as { id: string; pattern: string; meaning: string | null; structure: string | null; level: string | null }[];

  return runBatch(
    "grammar",
    rows.map((r) => ({
      id: r.id,
      label: `${r.pattern}${r.level ? ` (${r.level})` : ""}`,
      description: buildGrammarDescription(r),
    }))
  );
}

async function processStudyGuide() {
  const rows = (await sql`
    SELECT id, title, summary, content
    FROM posts
    WHERE status = ${status} AND content_type = 'study_guide' AND seo_description IS NULL
      AND (meta->>'merged_into_post_id') IS NULL
    ORDER BY created_at
    ${limit ? sql`LIMIT ${limit}` : sql``}
  `) as { id: string; title: string; summary: string | null; content: string | null }[];

  return runBatch(
    "study_guide",
    rows.map((r) => ({
      id: r.id,
      label: r.title,
      description: buildStudyGuideDescription(r),
    }))
  );
}

async function main() {
  console.log("Backfill seo_description");
  console.log("mode:", dryRun ? "DRY RUN (pass --apply=true to write)" : "APPLY (writing to DATABASE_URL)");
  console.log("status filter:", status);
  console.log("types:", types.join(", "));
  if (limit) console.log("limit per type:", limit);

  const runners: Record<ContentType, () => Promise<{ candidates: number; updated: number; skipped: number }>> = {
    vocabulary: processVocabulary,
    kanji: processKanji,
    grammar: processGrammar,
    study_guide: processStudyGuide,
  };

  const totals = { candidates: 0, updated: 0, skipped: 0 };
  for (const t of types) {
    const r = await runners[t]();
    totals.candidates += r.candidates;
    totals.updated += r.updated;
    totals.skipped += r.skipped;
  }

  console.log("\n=== Summary ===");
  console.log(`Candidates: ${totals.candidates}`);
  console.log(dryRun ? `Would update: ${totals.candidates - totals.skipped}` : `Updated: ${totals.updated}`);
  console.log(`Skipped (no usable data): ${totals.skipped}`);
  if (dryRun) console.log("\nDry run only. Add --apply=true to write.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
