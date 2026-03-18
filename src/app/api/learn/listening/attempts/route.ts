import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

/** POST /api/learn/listening/attempts — submit a listening attempt. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { scenarioId?: string; score?: number; totalQuestions?: number; responseTimeMs?: number; answers?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const scenarioId = typeof body.scenarioId === "string" ? body.scenarioId.trim() : "";
  const score = typeof body.score === "number" ? body.score : 0;
  const totalQuestions = typeof body.totalQuestions === "number" ? body.totalQuestions : 0;
  const responseTimeMs = typeof body.responseTimeMs === "number" ? body.responseTimeMs : null;
  const answers = body.answers != null ? body.answers : null;
  if (!scenarioId) return NextResponse.json({ error: "scenarioId required" }, { status: 400 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  try {
    await sql`
      INSERT INTO listening_attempts (user_email, scenario_id, score, total_questions, response_time_ms, answers)
      VALUES (${session.email}, ${scenarioId}, ${score}, ${totalQuestions}, ${responseTimeMs}, ${answers != null ? JSON.stringify(answers) : null}::jsonb)
    `;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to save attempt" }, { status: 500 });
  }
}
