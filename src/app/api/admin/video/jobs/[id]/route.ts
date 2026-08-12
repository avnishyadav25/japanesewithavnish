import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { cancelJob, logEvent, retryJob } from "@/lib/video/projects";
import { triggerRemoteWorker } from "@/lib/video/dispatch";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body?.action as string | undefined;

  if (action === "cancel") {
    const result = await cancelJob(id);
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: 409 });
    await logEvent({ renderJobId: id, actor: admin.email, eventType: "render_cancelled" });
    return NextResponse.json({ ok: true, message: result.message });
  }

  if (action === "retry") {
    const result = await retryJob(id);
    if (!result.ok) return NextResponse.json({ error: result.message }, { status: 409 });
    await logEvent({ renderJobId: id, actor: admin.email, eventType: "render_retried" });
    // Same best-effort nudge as the enqueue path; the row is already queued regardless.
    const rows = (await sql`SELECT project_id, storyboard_id, format FROM video_render_jobs WHERE id = ${id}::uuid`) as {
      project_id: string;
      storyboard_id: string;
      format: string;
    }[];
    const row = rows[0];
    const dispatch = row
      ? await triggerRemoteWorker({ projectId: row.project_id, storyboardId: row.storyboard_id, formats: [row.format] })
      : undefined;
    return NextResponse.json({ ok: true, message: result.message, dispatch });
  }

  return NextResponse.json({ error: 'action must be "cancel" or "retry"' }, { status: 400 });
}
