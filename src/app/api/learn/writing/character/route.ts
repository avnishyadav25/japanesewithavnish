import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

/**
 * GET /api/learn/writing/character?char=日&type=kanji
 * Returns stroke count and optional stroke_data for the character (kanji, hiragana, or katakana).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const char = url.searchParams.get("char");
  const type = (url.searchParams.get("type") || "kanji") as "kanji" | "hiragana" | "katakana";
  if (!char || char.length === 0) {
    return NextResponse.json({ error: "char required" }, { status: 400 });
  }
  if (!sql) {
    return NextResponse.json({ strokeCount: null, strokeData: null, reading: null });
  }
  try {
    if (type === "kanji") {
      const rows = await sql`
        SELECT character, stroke_count, stroke_data, meaning,
               onyomi, kunyomi
        FROM kanji
        WHERE character = ${char}
        LIMIT 1
      ` as { character: string; stroke_count: number | null; stroke_data: unknown; meaning: string | null; onyomi: string[] | null; kunyomi: string[] | null }[];
      const row = rows[0];
      if (!row) {
        return NextResponse.json({ strokeCount: null, strokeData: null, reading: null, meaning: null });
      }
      const reading = [...(row.onyomi || []), ...(row.kunyomi || [])].slice(0, 3).join(", ") || null;
      return NextResponse.json({
        character: row.character,
        strokeCount: row.stroke_count ?? null,
        strokeData: row.stroke_data ?? null,
        reading: reading || null,
        meaning: row.meaning ?? null,
      });
    }
    // hiragana or katakana
    const kanaType = type === "hiragana" ? "hiragana" : "katakana";
    const rows = await sql`
      SELECT character, stroke_count, stroke_data, romaji
      FROM kana
      WHERE character = ${char} AND type = ${kanaType}
      LIMIT 1
    ` as { character: string; stroke_count: number | null; stroke_data: unknown; romaji: string }[];
    const row = rows[0];
    if (!row) {
      return NextResponse.json({ strokeCount: null, strokeData: null, reading: null });
    }
    return NextResponse.json({
      character: row.character,
      strokeCount: row.stroke_count ?? null,
      strokeData: row.stroke_data ?? null,
      reading: row.romaji ?? null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch character" }, { status: 500 });
  }
}
