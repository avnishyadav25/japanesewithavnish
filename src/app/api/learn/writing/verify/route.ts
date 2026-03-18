import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

/** Body: { character: string, characterType: 'kanji'|'hiragana'|'katakana', strokes: { points: { x: number, y: number }[] }[] } */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { character?: string; characterType?: string; strokes?: { points: { x: number; y: number }[] }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const character = typeof body.character === "string" ? body.character.trim() : "";
  const characterType = (body.characterType === "hiragana" || body.characterType === "katakana" ? body.characterType : "kanji") as "kanji" | "hiragana" | "katakana";
  const strokes = Array.isArray(body.strokes) ? body.strokes : [];
  const strokeCount = strokes.filter((s) => Array.isArray(s?.points) && s.points.length > 0).length;

  if (!character) {
    return NextResponse.json({ error: "character required" }, { status: 400 });
  }

  let expectedCount: number | null = null;
  if (sql) {
    try {
      if (characterType === "kanji") {
        const rows = await sql`
          SELECT stroke_count FROM kanji WHERE character = ${character} LIMIT 1
        ` as { stroke_count: number | null }[];
        expectedCount = rows[0]?.stroke_count ?? null;
      } else {
        const kanaType = characterType === "hiragana" ? "hiragana" : "katakana";
        const rows = await sql`
          SELECT stroke_count FROM kana WHERE character = ${character} AND type = ${kanaType} LIMIT 1
        ` as { stroke_count: number | null }[];
        expectedCount = rows[0]?.stroke_count ?? null;
      }
    } catch (e) {
      console.error(e);
    }
  }

  // MVP: correct if stroke count matches. Later: compare order/direction using stroke_data.
  const correct = expectedCount != null && strokeCount === expectedCount;
  return NextResponse.json({
    correct,
    expectedStrokeCount: expectedCount ?? undefined,
    actualStrokeCount: strokeCount,
    feedback: correct ? "Correct stroke count." : expectedCount != null ? `Expected ${expectedCount} strokes, you drew ${strokeCount}.` : "Character not found in database; could not verify.",
  });
}
