import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; objectiveId: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id: lessonId, objectiveId } = await params;
  try {
    const body = await req.json();
    const textVal = typeof body.objective_text === "string" ? body.objective_text.trim() : null;
    const sortVal = typeof body.sort_order === "number" ? body.sort_order : null;
    const rows = await sql`
      UPDATE learning_objectives SET
        objective_text = COALESCE(${textVal}, objective_text),
        sort_order = COALESCE(${sortVal}, sort_order)
      WHERE id = ${objectiveId} AND lesson_id = ${lessonId}
      RETURNING id, lesson_id, objective_text, sort_order, created_at
    `;
    if (!(rows as unknown[])?.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json((rows as unknown[])[0]);
  } catch (e) {
    console.error("Learning objective PATCH:", e);
    return NextResponse.json({ error: "Failed to update objective" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; objectiveId: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id: lessonId, objectiveId } = await params;
  const result = await sql`DELETE FROM learning_objectives WHERE id = ${objectiveId} AND lesson_id = ${lessonId} RETURNING id`;
  if (!(result as unknown[])?.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
