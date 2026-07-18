import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

/** Same "full current state on every edit" PATCH semantics as the sections route. */
export async function PATCH(req: Request, { params }: { params: Promise<{ postId: string; sectionId: string; questionId: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { questionId } = await params;
  const body = await req.json();

  const existingRows = await sql`SELECT * FROM practice_test_questions WHERE id = ${questionId} LIMIT 1`;
  const existing = (existingRows as Record<string, unknown>[])[0];
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const questionText = "question_text" in body && typeof body.question_text === "string" && body.question_text.trim() ? body.question_text : existing.question_text;
  const itemType = "item_type" in body ? (typeof body.item_type === "string" ? body.item_type : null) : existing.item_type;
  const options = "options" in body && Array.isArray(body.options) ? body.options : existing.options;
  const correctIndex = "correct_index" in body && typeof body.correct_index === "number" ? body.correct_index : existing.correct_index;
  const explanation = "explanation" in body ? (typeof body.explanation === "string" ? body.explanation : null) : existing.explanation;
  const audioUrl = "audio_url" in body ? (typeof body.audio_url === "string" ? body.audio_url : null) : existing.audio_url;
  const sortOrder = "sort_order" in body && typeof body.sort_order === "number" ? body.sort_order : existing.sort_order;

  const rows = await sql`
    UPDATE practice_test_questions SET
      question_text = ${questionText}, item_type = ${itemType}::text, options = ${JSON.stringify(options)}::jsonb,
      correct_index = ${correctIndex}, explanation = ${explanation}::text, audio_url = ${audioUrl}::text,
      sort_order = ${sortOrder}::int, updated_at = NOW()
    WHERE id = ${questionId}
    RETURNING id, section_id, question_text, item_type, options, correct_index, explanation, audio_url, sort_order
  `;
  return NextResponse.json((rows as unknown[])[0]);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ postId: string; sectionId: string; questionId: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { questionId } = await params;
  const result = await sql`DELETE FROM practice_test_questions WHERE id = ${questionId} RETURNING id`;
  if (!(result as unknown[])?.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
