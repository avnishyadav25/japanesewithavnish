import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const lessonId = req.nextUrl.searchParams.get("lessonId");
  const vocabularyId = req.nextUrl.searchParams.get("vocabularyId");
  const grammarId = req.nextUrl.searchParams.get("grammarId");
  if (!lessonId && !vocabularyId && !grammarId) {
    return NextResponse.json({ error: "lessonId, vocabularyId, or grammarId required" }, { status: 400 });
  }
  let rows: { id: string; lesson_id: string | null; vocabulary_id: string | null; grammar_id: string | null; sentence_ja: string; sentence_romaji: string | null; sentence_en: string; notes: string | null; sort_order: number }[];
  if (lessonId) {
    rows = (await sql`
      SELECT id, lesson_id, vocabulary_id, grammar_id, sentence_ja, sentence_romaji, sentence_en, notes, sort_order
      FROM examples WHERE lesson_id = ${lessonId} ORDER BY sort_order, sentence_ja
    `) as typeof rows;
  } else if (vocabularyId) {
    rows = (await sql`
      SELECT id, lesson_id, vocabulary_id, grammar_id, sentence_ja, sentence_romaji, sentence_en, notes, sort_order
      FROM examples WHERE vocabulary_id = ${vocabularyId} ORDER BY sort_order, sentence_ja
    `) as typeof rows;
  } else {
    rows = (await sql`
      SELECT id, lesson_id, vocabulary_id, grammar_id, sentence_ja, sentence_romaji, sentence_en, notes, sort_order
      FROM examples WHERE grammar_id = ${grammarId!} ORDER BY sort_order, sentence_ja
    `) as typeof rows;
  }
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const body = await req.json();
  const { lesson_id, vocabulary_id, grammar_id, sentence_ja, sentence_romaji, sentence_en, notes, sort_order } = body;
  if (!sentence_ja || typeof sentence_ja !== "string" || !sentence_en || typeof sentence_en !== "string") {
    return NextResponse.json({ error: "sentence_ja and sentence_en required" }, { status: 400 });
  }
  if (!lesson_id && !vocabulary_id && !grammar_id) {
    return NextResponse.json({ error: "At least one of lesson_id, vocabulary_id, grammar_id required" }, { status: 400 });
  }
  const lessonIdVal = lesson_id && typeof lesson_id === "string" ? lesson_id : null;
  const vocabularyIdVal = vocabulary_id && typeof vocabulary_id === "string" ? vocabulary_id : null;
  const grammarIdVal = grammar_id && typeof grammar_id === "string" ? grammar_id : null;
  const romajiVal = typeof sentence_romaji === "string" ? sentence_romaji.trim() || null : null;
  const notesVal = typeof notes === "string" ? notes.trim() || null : null;
  const sort = typeof sort_order === "number" ? sort_order : 0;
  const rows = await sql`
    INSERT INTO examples (lesson_id, vocabulary_id, grammar_id, sentence_ja, sentence_romaji, sentence_en, notes, sort_order)
    VALUES (${lessonIdVal}, ${vocabularyIdVal}, ${grammarIdVal}, ${sentence_ja.trim()}, ${romajiVal}, ${sentence_en.trim()}, ${notesVal}, ${sort})
    RETURNING id, lesson_id, vocabulary_id, grammar_id, sentence_ja, sentence_romaji, sentence_en, notes, sort_order
  `;
  const row = (rows as { id: string; lesson_id: string | null; vocabulary_id: string | null; grammar_id: string | null; sentence_ja: string; sentence_romaji: string | null; sentence_en: string; notes: string | null; sort_order: number }[])[0];
  return NextResponse.json(row);
}
