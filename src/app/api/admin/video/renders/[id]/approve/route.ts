import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { logEvent, setProjectStatus } from "@/lib/video/projects";

/** The second gate. Only reached when the approval policy resolved to `dual_gate` — the render
 * is already finished and sitting in R2; this is a human confirming the actual MP4 is fit to
 * go out before it can be linked to a page or uploaded anywhere. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const decision = body?.decision === "reject" ? "reject" : "approve";

  const rows = (await sql`
    UPDATE video_renders
    SET approval_status = ${decision === "approve" ? "approved" : "rejected"},
        approved_by = ${decision === "approve" ? admin.email : null},
        approved_at = ${decision === "approve" ? new Date().toISOString() : null}
    WHERE id = ${id}::uuid AND approval_status = 'pending_review'
    RETURNING project_id
  `) as { project_id: string }[];

  if (!rows[0]) {
    return NextResponse.json({ error: "This video is not awaiting review." }, { status: 409 });
  }

  await setProjectStatus(rows[0].project_id, decision === "approve" ? "render_ready" : "rejected");
  await logEvent({
    projectId: rows[0].project_id,
    renderId: id,
    actor: admin.email,
    eventType: decision === "approve" ? "video_approved" : "video_rejected",
  });

  return NextResponse.json({ ok: true, approvalStatus: decision === "approve" ? "approved" : "rejected" });
}
