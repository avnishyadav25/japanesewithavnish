import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { sql } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  try {
    const body = await req.json();
    const { testId, score, totalQuestions, passed, sectionScores, answers, durationSeconds } = body;
    if (!testId || typeof testId !== "string") {
      return NextResponse.json({ error: "testId required" }, { status: 400 });
    }
    const scoreVal = typeof score === "number" ? score : 0;
    const totalVal = typeof totalQuestions === "number" ? totalQuestions : 0;
    const passedVal = !!passed;
    const sectionScoresJson = sectionScores && typeof sectionScores === "object" ? JSON.stringify(sectionScores) : "{}";
    const answersJson = answers && typeof answers === "object" ? JSON.stringify(answers) : "{}";
    const durationVal = typeof durationSeconds === "number" ? durationSeconds : null;

    const rows = await sql`
      INSERT INTO practice_test_attempts
        (practice_test_id, user_email, score, total_questions, passed, section_scores, answers, duration_seconds)
      VALUES
        (${testId}, ${session.email}, ${scoreVal}, ${totalVal}, ${passedVal}, ${sectionScoresJson}::jsonb, ${answersJson}::jsonb, ${durationVal})
      RETURNING id
    `;
    const row = (rows as { id: string }[])[0];
    return NextResponse.json({ success: true, attemptId: row?.id });
  } catch (e) {
    console.error("Practice test submit:", e);
    return NextResponse.json({ error: "Failed to submit practice test" }, { status: 500 });
  }
}
