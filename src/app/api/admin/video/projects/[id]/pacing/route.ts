import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import {
  enqueueRenderJobs,
  getProject,
  getStoryboard,
  insertStoryboardVersion,
  logEvent,
} from "@/lib/video/projects";
import { resolvePacing } from "@/lib/video/pacing";
import { needsRewrite, recutStoryboard } from "@/lib/video/recut";
import { triggerRemoteWorker } from "@/lib/video/dispatch";
import type { PacingConfig } from "@/lib/video/types";

/**
 * The FREE half of pacing: repeat count, shadowing pause, scene padding.
 *
 * Deliberately refuses anything that would need the script rewriting. `secondsPerItem` and
 * `examplesPerItem` set the word budget the model wrote to, so changing them means regenerating
 * narration and re-synthesising voice — that belongs on the generate route, which already reports
 * a cost, and mixing the two behind one endpoint is how a "free" button quietly becomes a bill.
 *
 * Mirrors the captions route in shape and in promise: change a setting, re-render, pay nothing,
 * because every audio clip is content-hashed and the transform keeps `text` and `spokenAs`
 * byte-identical.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const incoming = (body?.pacing ?? {}) as Partial<PacingConfig>;
  const applyToBatch = body?.applyToBatch === true;

  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const current = resolvePacing(project.pacing, undefined, project.stylePreset ?? "lesson");
  if (needsRewrite(current, incoming)) {
    return NextResponse.json(
      {
        error:
          "Seconds per item and examples per item change what the model writes, so they need the script regenerating. Use Rewrite instead — this endpoint only applies changes that cost nothing.",
      },
      { status: 400 }
    );
  }

  const pacing: PacingConfig = {
    ...current,
    repeatJapanese: clampRepeat(incoming.repeatJapanese ?? current.repeatJapanese),
    pauseAfterJapaneseSeconds: clamp(incoming.pauseAfterJapaneseSeconds ?? current.pauseAfterJapaneseSeconds, 0, 4),
    scenePaddingSeconds: clamp(incoming.scenePaddingSeconds ?? current.scenePaddingSeconds, 0, 2),
  };

  // The batch this project belongs to, when asked. Tuning one Short and pushing the result to the
  // other five is the difference between one edit and six.
  const targets = applyToBatch && project.batchId
    ? ((await sql`SELECT id FROM video_projects WHERE batch_id = ${project.batchId}::uuid`) as { id: string }[]).map((r) => r.id)
    : [id];

  const applied: { projectId: string; storyboardId: string; queued: string[] }[] = [];
  const skipped: string[] = [];

  for (const projectId of targets) {
    const target = projectId === id ? project : await getProject(projectId);
    if (!target?.currentStoryboardId) {
      skipped.push(projectId);
      continue;
    }
    const storyboard = await getStoryboard(target.currentStoryboardId);
    if (!storyboard) {
      skipped.push(projectId);
      continue;
    }

    await sql`UPDATE video_projects SET pacing = ${JSON.stringify(pacing)}::jsonb, updated_at = NOW() WHERE id = ${projectId}::uuid`;

    const version = await insertStoryboardVersion({
      projectId,
      narrationLang: storyboard.narrationLang,
      source: "human_edited",
      doc: recutStoryboard(storyboard.doc, pacing),
      parentStoryboardId: storyboard.id,
      // Inherits the parent's approval: a re-cut changes no words, so re-approving identical
      // narration would be a rubber stamp that trains you to click through gates.
      approvalStatus: storyboard.approvalStatus === "approved" ? "approved" : "draft",
      createdBy: admin.email,
    });

    const { queued } = await enqueueRenderJobs({
      projectId,
      storyboardId: version.id,
      formats: target.formats,
      requestedBy: admin.email,
    });
    applied.push({ projectId, storyboardId: version.id, queued });
  }

  await logEvent({
    projectId: id,
    actor: admin.email,
    eventType: "pacing_recut",
    payload: { pacing, applyToBatch, projects: applied.length, skipped: skipped.length },
  });

  // Same dispatch the render route uses, so a re-cut starts in seconds rather than waiting for
  // the 15-minute safety-net schedule.
  const first = applied.find((a) => a.queued.length > 0);
  if (first) {
    await triggerRemoteWorker({ projectId: first.projectId, storyboardId: first.storyboardId, formats: first.queued as never });
  }

  return NextResponse.json({
    pacing,
    projects: applied.length,
    skipped: skipped.length,
    message:
      `Re-cut ${applied.length} project${applied.length === 1 ? "" : "s"} and queued ${applied.reduce((n, a) => n + a.queued.length, 0)} render(s). ` +
      `No script was rewritten and no voiceover was charged — every clip comes from cache.` +
      (skipped.length > 0 ? ` ${skipped.length} skipped: no script generated yet.` : ""),
  });
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Number.isFinite(Number(n)) ? Number(n) : lo));
}

function clampRepeat(n: number): 1 | 2 | 3 {
  const r = Math.round(clamp(n, 1, 3));
  return (r === 1 || r === 2 || r === 3 ? r : 2) as 1 | 2 | 3;
}
