import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function POST(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { question_text, options, correct_answer, correct_index, jlpt_level, sort_order } = body;
  const correctIdx = typeof correct_index === "number" ? correct_index : (typeof correct_answer === "string" && /^[A-Z]$/.test(correct_answer) ? correct_answer.charCodeAt(0) - 65 : 0);

  if (!question_text) {
    return NextResponse.json({ error: "question_text is required" }, { status: 400 });
  }

  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const rows = await sql`
    INSERT INTO quiz_questions (question_text, options, correct_index, jlpt_level, sort_order)
    VALUES (${question_text}, ${options || []}, ${correctIdx}, ${jlpt_level || null}, ${sort_order ?? 0})
    RETURNING id
  `;
  const data = rows[0] as { id: string };
  return NextResponse.json(data);
}

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const data = await sql`SELECT * FROM quiz_questions ORDER BY sort_order ASC, created_at DESC`;
  return NextResponse.json(data);
}
