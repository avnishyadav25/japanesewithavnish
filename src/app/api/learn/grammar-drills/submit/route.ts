import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

/** POST /api/learn/grammar-drills/submit — record response for analytics. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { drillId?: string; correct?: boolean; responseTimeMs?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const drillId = typeof body.drillId === "string" ? body.drillId.trim() : "";
  const correct = Boolean(body.correct);
  const responseTimeMs = typeof body.responseTimeMs === "number" ? body.responseTimeMs : null;
  if (!drillId) return NextResponse.json({ error: "drillId required" }, { status: 400 });
  if (!sql) return NextResponse.json({ ok: true });
  try {
    await sql`
      INSERT INTO grammar_drill_responses (user_email, drill_id, correct, response_time_ms)
      VALUES (${session.email}, ${drillId}, ${correct}, ${responseTimeMs})
    `;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: true });
  }
}
