/**
 * Backfill kana.stroke_data and kanji.stroke_data from KanjiVG.
 *
 * KanjiVG (https://kanjivg.tagaini.net, CC BY-SA 3.0) publishes one SVG per
 * character with stroke paths in a 109x109 viewBox — the same format the
 * writing/tracing UI already consumes (array of SVG path `d` strings, see
 * src/app/api/learn/writing/character/route.ts).
 *
 * Usage: npx tsx scripts/backfill-strokes-kanjivg.ts [--dry-run]
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const KANJIVG_RAW = "https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji";

const sql = neon(process.env.DATABASE_URL!);
const dryRun = process.argv.includes("--dry-run");

function kanjivgFilename(char: string): string {
  return char.codePointAt(0)!.toString(16).padStart(5, "0") + ".svg";
}

/** Extract stroke path `d` attributes in document order. */
function extractStrokePaths(svg: string): string[] {
  const paths: string[] = [];
  const re = /<path[^>]*\bd="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg))) paths.push(m[1]);
  return paths;
}

async function fetchStrokes(char: string): Promise<string[] | null> {
  const url = `${KANJIVG_RAW}/${kanjivgFilename(char)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const paths = extractStrokePaths(await res.text());
  return paths.length > 0 ? paths : null;
}

async function backfillTable(table: "kana" | "kanji") {
  const rows = (await sql`
    SELECT id, character FROM ${sql.unsafe(table)}
    WHERE stroke_data IS NULL
       OR stroke_data::text IN ('null', '[]', '{}')
    ORDER BY character
  `) as { id: string; character: string }[];

  console.log(`[${table}] ${rows.length} rows missing stroke_data`);
  let done = 0;
  let missing = 0;

  for (const row of rows) {
    const char = row.character?.trim();
    if (!char) {
      missing++;
      continue;
    }
    const strokes = await fetchStrokes(char);
    if (!strokes) {
      console.warn(`[${table}] no KanjiVG data for "${char}"`);
      missing++;
      continue;
    }
    if (!dryRun) {
      await sql`
        UPDATE ${sql.unsafe(table)}
        SET stroke_data = ${JSON.stringify(strokes)}::jsonb,
            stroke_count = COALESCE(stroke_count, ${strokes.length})
        WHERE id = ${row.id}
      `;
    }
    done++;
    if (done % 25 === 0) console.log(`[${table}] ${done}/${rows.length}`);
  }

  console.log(`[${table}] updated=${done} missing=${missing}${dryRun ? " (dry run)" : ""}`);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
  await backfillTable("kana");
  await backfillTable("kanji");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
