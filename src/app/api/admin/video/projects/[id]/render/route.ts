import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import {
  enqueueRenderJobs,
  getProject,
  getStoryboard,
  logEvent,
  setProjectStatus,
} from "@/lib/video/projects";
import { triggerRemoteWorker } from "@/lib/video/dispatch";
import { VIDEO_FORMATS, type VideoFormat } from "@/lib/video/types";

/**
 * Enqueues render jobs. This route does not render anything — it writes queue rows and pokes
 * the remote worker. Rendering needs a headless Chrome and ffmpeg, neither of which exists in
 * a Netlify function, and takes minutes against a ~10s limit.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const storyboardId = (body?.storyboardId as string | undefined) ?? project.currentStoryboardId;
  if (!storyboardId) {
    return NextResponse.json({ error: "Generate a script before rendering." }, { status: 400 });
  }

  const storyboard = await getStoryboard(storyboardId);
  if (!storyboard || storyboard.projectId !== id) {
    return NextResponse.json({ error: "Storyboard not found for this project" }, { status: 404 });
  }
  // The script gate lives here, not in the worker: refusing at enqueue time means an
  // unapproved script never consumes render minutes in the first place.
  if (storyboard.approvalStatus !== "approved") {
    return NextResponse.json(
      { error: `This script is "${storyboard.approvalStatus}". Approve it before rendering.` },
      { status: 409 }
    );
  }
  if (storyboard.doc.scenes.length === 0) {
    return NextResponse.json({ error: "This storyboard has no scenes." }, { status: 400 });
  }

  const requested = Array.isArray(body?.formats) && body.formats.length > 0 ? body.formats : project.formats;
  const formats = requested.filter((f: string) => VIDEO_FORMATS.includes(f as VideoFormat)) as VideoFormat[];
  if (formats.length === 0) return NextResponse.json({ error: "No valid output format requested" }, { status: 400 });

  const { queued, skipped } = await enqueueRenderJobs({
    projectId: id,
    storyboardId,
    formats,
    requestedBy: admin.email,
    priority: typeof body?.priority === "number" ? body.priority : 100,
  });

  if (queued.length > 0) await setProjectStatus(id, "queued_render");

  await logEvent({
    projectId: id,
    storyboardId,
    actor: admin.email,
    eventType: "render_enqueued",
    payload: { queued, skipped },
  });

  // Best-effort nudge so a GitHub Actions run starts now rather than at the next 15-minute
  // tick. A local worker polling every 5s doesn't need it, and a failure here is not a failure
  // of the enqueue — the job is already durably queued.
  const dispatch = await triggerRemoteWorker({ projectId: id, storyboardId, formats: queued });

  return NextResponse.json({
    queued,
    skipped,
    dispatch,
    message:
      queued.length === 0
        ? "Already queued or in progress for every requested format."
        : `Queued ${queued.length} render${queued.length === 1 ? "" : "s"}.`,
  });
}
