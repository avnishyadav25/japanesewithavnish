import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id: lessonId } = await params;
  const rows = await sql`
    SELECT clg.id, clg.lesson_id, clg.grammar_id, clg.sort_order, g.pattern, g.structure
    FROM curriculum_lesson_grammar clg
    JOIN grammar g ON g.id = clg.grammar_id
    WHERE clg.lesson_id = ${lessonId}
    ORDER BY clg.sort_order, g.pattern
  `;
  return NextResponse.json(rows as { id: string; lesson_id: string; grammar_id: string; sort_order: number; pattern: string | null; structure: string | null }[]);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id: lessonId } = await params;
  const body = await req.json();
  const { grammar_id, sort_order } = body;
  if (!grammar_id || typeof grammar_id !== "string") {
    return NextResponse.json({ error: "grammar_id required" }, { status: 400 });
  }
  const sort = typeof sort_order === "number" ? sort_order : 0;
  const rows = await sql`
    INSERT INTO curriculum_lesson_grammar (lesson_id, grammar_id, sort_order)
    VALUES (${lessonId}, ${grammar_id}, ${sort})
    ON CONFLICT (lesson_id, grammar_id) DO UPDATE SET sort_order = EXCLUDED.sort_order
    RETURNING id, lesson_id, grammar_id, sort_order
  `;
  const row = (rows as { id: string; lesson_id: string; grammar_id: string; sort_order: number }[])[0];
  return NextResponse.json(row);
}
