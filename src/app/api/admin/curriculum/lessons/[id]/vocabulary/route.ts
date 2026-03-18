import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id: lessonId } = await params;
  const rows = await sql`
    SELECT clv.id, clv.lesson_id, clv.vocabulary_id, clv.sort_order, v.word, v.reading, v.meaning
    FROM curriculum_lesson_vocabulary clv
    JOIN vocabulary v ON v.id = clv.vocabulary_id
    WHERE clv.lesson_id = ${lessonId}
    ORDER BY clv.sort_order, v.word
  `;
  return NextResponse.json(rows as { id: string; lesson_id: string; vocabulary_id: string; sort_order: number; word: string | null; reading: string | null; meaning: string | null }[]);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id: lessonId } = await params;
  const body = await req.json();
  const { vocabulary_id, sort_order } = body;
  if (!vocabulary_id || typeof vocabulary_id !== "string") {
    return NextResponse.json({ error: "vocabulary_id required" }, { status: 400 });
  }
  const sort = typeof sort_order === "number" ? sort_order : 0;
  const rows = await sql`
    INSERT INTO curriculum_lesson_vocabulary (lesson_id, vocabulary_id, sort_order)
    VALUES (${lessonId}, ${vocabulary_id}, ${sort})
    ON CONFLICT (lesson_id, vocabulary_id) DO UPDATE SET sort_order = EXCLUDED.sort_order
    RETURNING id, lesson_id, vocabulary_id, sort_order
  `;
  const row = (rows as { id: string; lesson_id: string; vocabulary_id: string; sort_order: number }[])[0];
  return NextResponse.json(row);
}
