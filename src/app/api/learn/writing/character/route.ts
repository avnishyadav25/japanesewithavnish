import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import fs from "fs";
import path from "path";

// Cache JSON data in memory to avoid reading from disk on every API call
let kanjiJsonData: Record<string, unknown> | null = null;

function getKanjiJson() {
  if (kanjiJsonData) return kanjiJsonData;
  try {
    const filePath = path.join(process.cwd(), "src/data/kanji_jlpt_only.json");
    if (fs.existsSync(filePath)) {
      kanjiJsonData = JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  } catch (e) {
    console.error("[getKanjiJson] Error reading file:", e);
  }
  return kanjiJsonData || {};
}

/**
 * GET /api/learn/writing/character?char=日&type=kanji
 * Returns stroke count, Onyomi/Kunyomi, meaning, and dynamic vocabulary examples.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const char = url.searchParams.get("char");
  const type = (url.searchParams.get("type") || "kanji") as "kanji" | "hiragana" | "katakana";
  
  if (!char || char.length === 0) {
    return NextResponse.json({ error: "char required" }, { status: 400 });
  }

  // Fetch dynamic vocabulary examples containing this character
  let examples: { word: string; reading: string; meaning: string }[] = [];
  if (sql) {
    try {
      const pattern = `%${char}%`;
      examples = (await sql`
        SELECT word, reading, meaning
        FROM vocabulary
        WHERE word LIKE ${pattern} OR reading LIKE ${pattern}
        ORDER BY word ASC
        LIMIT 3
      `) as { word: string; reading: string; meaning: string }[];
    } catch (err) {
      console.error("[API Character] Error fetching examples:", err);
    }
  }

  try {
    if (type === "kanji") {
      let strokeCount: number | null = null;
      let reading: string | null = null;
      let meaning: string | null = null;
      let onyomi: string[] | null = null;
      let kunyomi: string[] | null = null;
      let found = false;

      if (sql) {
        const rows = await sql`
          SELECT character, stroke_count, meaning, onyomi, kunyomi
          FROM kanji
          WHERE character = ${char}
          LIMIT 1
        ` as { character: string; stroke_count: number | null; meaning: string | null; onyomi: string[] | null; kunyomi: string[] | null }[];
        
        if (rows[0]) {
          const row = rows[0];
          strokeCount = row.stroke_count;
          onyomi = row.onyomi;
          kunyomi = row.kunyomi;
          reading = [...(row.onyomi || []), ...(row.kunyomi || [])].slice(0, 3).join(", ") || null;
          meaning = row.meaning;
          found = true;
        }
      }

      if (!found) {
        // Fallback to offline JSON database
        interface KanjiJsonInfo {
          stroke_count?: number;
          on_readings?: string[];
          kun_readings?: string[];
          meanings?: string[];
          jlpt?: number;
        }
        const kanjiDict = getKanjiJson();
        const info = kanjiDict[char] as KanjiJsonInfo | undefined;
        if (info) {
          strokeCount = info.stroke_count || null;
          onyomi = info.on_readings || null;
          kunyomi = info.kun_readings || null;
          reading = [...(onyomi || []), ...(kunyomi || [])].slice(0, 3).join(", ") || null;
          meaning = (info.meanings || []).join(", ") || null;
        }
      }

      return NextResponse.json({
        character: char,
        strokeCount,
        reading,
        meaning,
        onyomi,
        kunyomi,
        examples,
      });
    }

    // Hiragana or Katakana
    let strokeCount: number | null = null;
    let reading: string | null = null;
    let found = false;

    if (sql) {
      const kanaType = type === "hiragana" ? "hiragana" : "katakana";
      const rows = await sql`
        SELECT character, stroke_count, romaji
        FROM kana
        WHERE character = ${char} AND type = ${kanaType}
        LIMIT 1
      ` as { character: string; stroke_count: number | null; romaji: string }[];
      
      if (rows[0]) {
        strokeCount = rows[0].stroke_count;
        reading = rows[0].romaji;
        found = true;
      }
    }

    // If not found in DB, return simple fallback
    if (!found) {
      reading = char;
    }

    return NextResponse.json({
      character: char,
      strokeCount,
      reading,
      examples,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch character details" }, { status: 500 });
  }
}
