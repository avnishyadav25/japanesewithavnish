import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

/** GET /api/learn/listening/scenarios/[id] — scenario + questions (without correct_index in options for client). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  try {
    const scenarioRows = await sql`
      SELECT id, title, audio_url, transcript, sort_order
      FROM listening_scenarios WHERE id = ${id} LIMIT 1
    ` as { id: string; title: string; audio_url: string; transcript: string | null; sort_order: number }[];
    const scenario = scenarioRows[0];
    if (!scenario) return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
    const questionRows = await sql`
      SELECT id, question_text, options, correct_index, sort_order
      FROM listening_questions
      WHERE scenario_id = ${id}
      ORDER BY sort_order, id
    ` as { id: string; question_text: string; options: unknown; correct_index: number; sort_order: number }[];
    const questions = questionRows.map((q) => ({
      id: q.id,
      questionText: q.question_text,
      options: Array.isArray(q.options) ? q.options : (q.options as Record<string, unknown>)?.options ?? [],
      correctIndex: q.correct_index,
      sortOrder: q.sort_order,
    }));
    return NextResponse.json({
      scenario: {
        id: scenario.id,
        title: scenario.title,
        audioUrl: scenario.audio_url,
        transcript: scenario.transcript,
        sortOrder: scenario.sort_order,
      },
      questions,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load scenario" }, { status: 500 });
  }
}
