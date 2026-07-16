import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

const VALID_DECISIONS = ["accept", "reject", "mark_fixed", "false_positive"];
// Finding status mirrors the decision 1:1 except "accept" — accepting a finding means the
// human agrees it's real, not that it's resolved; it stays open until actually fixed.
const STATUS_BY_DECISION: Record<string, string> = {
  accept: "accepted",
  reject: "rejected",
  mark_fixed: "fixed",
  false_positive: "false_positive",
};

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const decision = body?.decision;
  const decisionNote = typeof body?.decisionNote === "string" ? body.decisionNote : null;

  if (typeof decision !== "string" || !VALID_DECISIONS.includes(decision)) {
    return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  }

  const findingRows = await sql`SELECT id, status FROM content_review_findings WHERE id = ${id}`;
  if (!findingRows[0]) return NextResponse.json({ error: "Finding not found" }, { status: 404 });

  await sql`
    INSERT INTO content_review_decisions (finding_id, decision, decision_note, decided_by)
    VALUES (${id}, ${decision}, ${decisionNote}, ${admin.email})
  `;
  await sql`UPDATE content_review_findings SET status = ${STATUS_BY_DECISION[decision]} WHERE id = ${id}`;

  return NextResponse.json({ success: true });
}
