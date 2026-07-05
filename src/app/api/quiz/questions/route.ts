import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  let data: { id: string; question_text: string; options: unknown; correct_index: number; jlpt_level: string }[] = [];
  if (sql) {
    const rows = await sql`SELECT id, question_text, options, correct_index, jlpt_level FROM quiz_questions ORDER BY sort_order ASC LIMIT 100`;
    data = (rows ?? []) as typeof data;
  }
  const questions = data.map((q) => ({
    ...q,
    options: Array.isArray(q.options) ? q.options : (q.options as { text: string }[])?.map((o) => o.text) || [],
  }));
  return NextResponse.json({ questions });
}
