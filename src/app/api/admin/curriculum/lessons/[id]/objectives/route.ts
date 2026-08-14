import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id } = await params;
  const rows = await sql`
    SELECT id, lesson_id, objective_text, sort_order, created_at
    FROM learning_objectives
    WHERE lesson_id = ${id}
    ORDER BY sort_order, created_at
  `;
  return NextResponse.json(rows);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id: lessonId } = await params;
  try {
    const body = await req.json();
    const objectiveText = typeof body.objective_text === "string" ? body.objective_text.trim() : "";
    if (!objectiveText) {
      return NextResponse.json({ error: "objective_text required" }, { status: 400 });
    }
    const maxSortRows = await sql`SELECT COALESCE(MAX(sort_order), 0) AS max FROM learning_objectives WHERE lesson_id = ${lessonId}`;
    const nextSort = ((maxSortRows as { max: number }[])[0]?.max ?? 0) + 10;
    const rows = await sql`
      INSERT INTO learning_objectives (lesson_id, objective_text, sort_order)
      VALUES (${lessonId}, ${objectiveText}, ${nextSort})
      RETURNING id, lesson_id, objective_text, sort_order, created_at
    `;
    return NextResponse.json((rows as object[])[0]);
  } catch (e) {
    console.error("Learning objectives POST:", e);
    return NextResponse.json({ error: "Failed to create objective" }, { status: 500 });
  }
}
