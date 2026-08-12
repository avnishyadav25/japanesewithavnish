import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { getStoryboard, logEvent, setProjectStatus, setStoryboardApproval } from "@/lib/video/projects";

/** The script gate. Approving here is what allows the render route to enqueue work, so this is
 * the point where a human takes responsibility for what the voice is about to say. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const storyboard = await getStoryboard(id);
  if (!storyboard) return NextResponse.json({ error: "Storyboard not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const decision = body?.decision === "reject" ? "reject" : "approve";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : null;

  if (decision === "reject" && !reason) {
    return NextResponse.json({ error: "A rejection needs a reason so the regenerate has something to act on." }, { status: 400 });
  }
  if (storyboard.approvalStatus === "superseded") {
    return NextResponse.json({ error: "This version has been superseded by a newer one." }, { status: 409 });
  }

  await setStoryboardApproval(id, decision === "approve" ? "approved" : "rejected", admin.email, reason);
  await setProjectStatus(storyboard.projectId, decision === "approve" ? "script_ready" : "rejected");
  await logEvent({
    projectId: storyboard.projectId,
    storyboardId: id,
    actor: admin.email,
    eventType: decision === "approve" ? "script_approved" : "script_rejected",
    payload: { version: storyboard.version, reason },
  });

  return NextResponse.json({ ok: true, approvalStatus: decision === "approve" ? "approved" : "rejected" });
}
