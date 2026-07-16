import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { logAuditEvent } from "@/lib/contentReview/auditLog";

// Only the human-decision states are settable through this route. The AI-pipeline-internal
// states (queued/validating/ai_reviewing/...) are only ever set by jobRunner.ts, and
// "published" is only ever set as a side effect of the actual publish action (Phase G),
// never directly here.
const HUMAN_SETTABLE_STATES = ["approved", "changes_requested", "rejected", "archived"];

export async function PATCH(req: Request, { params }: { params: Promise<{ postId: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { postId } = await params;
  const body = await req.json().catch(() => null);
  const reviewState = body?.reviewState;

  if (typeof reviewState !== "string" || !HUMAN_SETTABLE_STATES.includes(reviewState)) {
    return NextResponse.json({ error: "Invalid reviewState" }, { status: 400 });
  }

  const rows = (await sql`UPDATE posts SET review_state = ${reviewState} WHERE id = ${postId} RETURNING id, content_type`) as {
    id: string;
    content_type: string;
  }[];
  if (!rows[0]) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  await logAuditEvent({ actor: admin.email, action: reviewState, entityType: rows[0].content_type, entityId: postId, detail: { source: "detail_page" } });

  return NextResponse.json({ success: true });
}
