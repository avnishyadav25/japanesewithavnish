import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function POST(req: Request, { params }: { params: Promise<{ postId: string; sectionId: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { sectionId } = await params;
  const body = await req.json();

  const questionText = typeof body.question_text === "string" && body.question_text.trim() ? body.question_text : "New question";
  const options = Array.isArray(body.options) && body.options.length > 0 ? body.options : ["", ""];
  const correctIndex = typeof body.correct_index === "number" ? body.correct_index : 0;

  const maxSortRows = await sql`SELECT COALESCE(MAX(sort_order), 0) AS max FROM practice_test_questions WHERE section_id = ${sectionId}`;
  const nextSort = ((maxSortRows as { max: number }[])[0]?.max ?? 0) + 10;

  const rows = await sql`
    INSERT INTO practice_test_questions (section_id, question_text, options, correct_index, sort_order)
    VALUES (${sectionId}, ${questionText}, ${JSON.stringify(options)}::jsonb, ${correctIndex}, ${nextSort})
    RETURNING id, section_id, question_text, item_type, options, correct_index, explanation, audio_url, sort_order
  `;
  return NextResponse.json((rows as unknown[])[0]);
}
