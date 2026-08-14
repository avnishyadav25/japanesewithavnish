import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

/**
 * GET /api/learn/exam/definition?levelId=...
 * Returns exam definition for mock: level exam record + questions (from quiz_questions by level code).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const levelId = url.searchParams.get("levelId")?.trim();
  if (!levelId) return NextResponse.json({ error: "levelId required" }, { status: 400 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  try {
    const levelRows = await sql`
      SELECT id, code FROM curriculum_levels WHERE id = ${levelId} LIMIT 1
    ` as { id: string; code: string }[];
    const level = levelRows[0];
    if (!level) return NextResponse.json({ error: "Level not found" }, { status: 404 });
    const examRows = await sql`
      SELECT id, title, exam_type, meta FROM curriculum_level_exams
      WHERE level_id = ${levelId} ORDER BY created_at LIMIT 1
    ` as { id: string; title: string; exam_type: string; meta: unknown }[];
    const exam = examRows[0];
    const meta = (exam?.meta as { durationMinutes?: number }) ?? {};
    const durationMinutes = meta.durationMinutes ?? 15;
    const qRows = await sql`
      SELECT id, question_text, options, correct_index
      FROM quiz_questions
      WHERE jlpt_level = ${level.code}
      ORDER BY sort_order NULLS LAST, id
      LIMIT 30
    ` as { id: string; question_text: string; options: unknown; correct_index: number }[];
    const questions = qRows.map((q) => ({
      id: q.id,
      questionText: q.question_text,
      options: Array.isArray(q.options) ? q.options : [],
      correctIndex: q.correct_index,
    }));
    return NextResponse.json({
      examId: exam?.id,
      levelId: level.id,
      levelCode: level.code,
      title: exam?.title ?? `${level.code} Mock Exam`,
      examType: exam?.exam_type ?? "mock",
      durationMinutes,
      questions,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load exam" }, { status: 500 });
  }
}
