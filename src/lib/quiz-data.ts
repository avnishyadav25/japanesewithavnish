import { sql } from "@/lib/db";

export type QuizQuestion = {
  id: string;
  question_text: string;
  options: string[];
  correct_index: number;
  jlpt_level: string;
};

export async function getQuizQuestions(): Promise<QuizQuestion[]> {
  if (!sql) return [];
  const rows = (await sql`
    SELECT id, question_text, options, correct_index, jlpt_level
    FROM quiz_questions ORDER BY sort_order ASC LIMIT 100
  `) as { id: string; question_text: string; options: unknown; correct_index: number; jlpt_level: string }[];
  return rows.map((q) => ({
    ...q,
    options: Array.isArray(q.options) ? q.options : (q.options as { text: string }[])?.map((o) => o.text) || [],
  }));
}
