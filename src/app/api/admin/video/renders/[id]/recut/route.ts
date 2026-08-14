import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { createProject, enqueueRenderJobs, getProject, insertStoryboardVersion, logEvent, setProjectStatus } from "@/lib/video/projects";
import { triggerRemoteWorker } from "@/lib/video/dispatch";
import { VIDEO_FORMATS, type Storyboard, type VideoFormat } from "@/lib/video/types";

/**
 * Turns a finished render into something else.
 *
 *   formats    the same storyboard at other aspect ratios
 *   duplicate  an editable copy, so the original stays untouched
 *
 * Both are cheap in the way that matters: narration is cached by content hash, so re-rendering
 * the same script at 16:9 costs render time and nothing in TTS.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const mode = body?.mode === "duplicate" ? "duplicate" : "formats";

  const rows = (await sql`
    SELECT r.project_id, r.storyboard_id, r.narration_lang, r.format,
           s.doc, s.narration_lang AS sb_lang
    FROM video_renders r
    JOIN video_storyboards s ON s.id = r.storyboard_id
    WHERE r.id = ${id}::uuid
  `) as { project_id: string; storyboard_id: string; narration_lang: string; format: string; doc: Storyboard }[];

  const render = rows[0];
  if (!render) return NextResponse.json({ error: "Render not found" }, { status: 404 });

  const project = await getProject(render.project_id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  // ---- same content, more formats -----------------------------------------
  if (mode === "formats") {
    const requested = (Array.isArray(body?.formats) ? body.formats : []).filter((f: string) =>
      VIDEO_FORMATS.includes(f as VideoFormat)
    ) as VideoFormat[];
    if (requested.length === 0) {
      return NextResponse.json({ error: "Pick at least one format to add" }, { status: 400 });
    }

    const { queued, skipped } = await enqueueRenderJobs({
      projectId: render.project_id,
      storyboardId: render.storyboard_id,
      formats: requested,
      requestedBy: admin.email,
    });

    if (queued.length > 0) await setProjectStatus(render.project_id, "queued_render");
    await logEvent({
      projectId: render.project_id,
      renderId: id,
      actor: admin.email,
      eventType: "recut_formats",
      payload: { queued, skipped },
    });

    const dispatch = await triggerRemoteWorker({
      projectId: render.project_id,
      storyboardId: render.storyboard_id,
      formats: queued,
    });

    return NextResponse.json({
      queued,
      skipped,
      dispatch,
      message:
        queued.length === 0
          ? "Already queued or rendered for every format you picked."
          : `Queued ${queued.length} more render${queued.length === 1 ? "" : "s"}. The voiceover is already cached, so this costs render time only.`,
    });
  }

  // ---- duplicate into an editable copy -------------------------------------
  const copy = await createProject({
    title: `${project.title} (copy)`,
    scopeKind: project.scopeKind,
    scopeRef: project.scopeRef,
    grouping: project.grouping,
    themeKey: typeof body?.themeKey === "string" ? body.themeKey : project.themeKey,
    bgmTrackId: body?.bgmTrackId === null ? null : (body?.bgmTrackId ?? project.bgmTrackId),
    narrationLangs: project.narrationLangs,
    formats: (Array.isArray(body?.formats) && body.formats.length > 0 ? body.formats : project.formats) as VideoFormat[],
    tone: project.tone,
    includeBroll: project.includeBroll,
    pacing: project.pacing,
    voices: project.voices,
    createdBy: admin.email,
  });

  // The cloned doc keeps every segment's `audio`, so the copy's first render reuses the cached
  // clips rather than re-billing Google for narration that has not changed.
  const clonedDoc: Storyboard = { ...render.doc, projectId: copy.id, resolved: undefined };

  const storyboard = await insertStoryboardVersion({
    projectId: copy.id,
    narrationLang: render.narration_lang as Storyboard["narrationLang"],
    source: "imported",
    doc: clonedDoc,
    // A duplicate is a deliberate act by someone who has already watched the original, so it
    // arrives approved rather than sending them back through the review gate for a copy.
    approvalStatus: "approved",
    createdBy: admin.email,
  });

  await setProjectStatus(copy.id, "script_ready");
  await logEvent({
    projectId: copy.id,
    storyboardId: storyboard.id,
    actor: admin.email,
    eventType: "duplicated_from_render",
    payload: { sourceRenderId: id, sourceProjectId: render.project_id },
  });

  return NextResponse.json({
    projectId: copy.id,
    storyboardId: storyboard.id,
    message: "Duplicated. Edit the copy freely — the original is untouched and its voiceover is reused.",
  });
}
