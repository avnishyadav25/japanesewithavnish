import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

/**
 * GET /api/learn/grammar-drills?lessonId=... or ?grammarId=...
 * Returns drill items for the lesson or grammar.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const lessonId = url.searchParams.get("lessonId")?.trim();
  const grammarId = url.searchParams.get("grammarId")?.trim();
  if (!lessonId && !grammarId) {
    return NextResponse.json({ error: "lessonId or grammarId required" }, { status: 400 });
  }
  if (!sql) return NextResponse.json({ items: [] });
  try {
    const rows = lessonId
      ? await sql`
          SELECT id, lesson_id, grammar_id, sentence_ja, correct_answers, distractors, hint, sort_order
          FROM grammar_drill_items
          WHERE lesson_id = ${lessonId}
          ORDER BY sort_order, id
        `
      : await sql`
          SELECT id, lesson_id, grammar_id, sentence_ja, correct_answers, distractors, hint, sort_order
          FROM grammar_drill_items
          WHERE grammar_id = ${grammarId}
          ORDER BY sort_order, id
        `;
    const items = (rows as { id: string; lesson_id: string | null; grammar_id: string | null; sentence_ja: string; correct_answers: unknown; distractors: unknown; hint: string | null; sort_order: number }[]).map((r) => ({
      id: r.id,
      lessonId: r.lesson_id,
      grammarId: r.grammar_id,
      sentenceJa: r.sentence_ja,
      correctAnswers: Array.isArray(r.correct_answers) ? r.correct_answers : (r.correct_answers as Record<string, unknown>)?.answers ?? [],
      distractors: Array.isArray(r.distractors) ? r.distractors : (r.distractors as Record<string, unknown>)?.options ?? [],
      hint: r.hint,
      sortOrder: r.sort_order,
    }));
    return NextResponse.json({ items });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load drills", items: [] }, { status: 500 });
  }
}
