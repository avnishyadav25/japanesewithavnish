import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { createProject, getProject, getStoryboard, insertStoryboardVersion, logEvent, setProjectStatus } from "@/lib/video/projects";
import { recordGenerationRun } from "@/lib/video/audit";
import { buildHighlight, listHighlightScenes, suggestHighlight } from "@/lib/video/highlight";
import type { NarrationLang } from "@/lib/video/types";

/**
 * Cuts a Short out of a long video.
 *
 * GET  lists the scenes with their real durations and a suggested selection.
 * POST creates a new vertical project from the chosen scenes.
 *
 * A NEW PROJECT rather than a new version of this one, because the Short is a different video with
 * its own renders, its own social posts and its own life. Overwriting the lesson's storyboard with
 * a 45-second cut would destroy the thing the Short was cut from.
 *
 * It costs nothing in TTS. Narration audio is cached by a hash of its text and voice, so every
 * surviving scene re-uses the clip the long video already paid for — only render minutes.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const storyboard = await getStoryboard(id);
  if (!storyboard) return NextResponse.json({ error: "Storyboard not found" }, { status: 404 });

  const scenes = listHighlightScenes(storyboard.doc);
  return NextResponse.json({
    scenes,
    suggested: suggestHighlight(scenes),
    totalSeconds: Number(scenes.reduce((n, s) => n + s.seconds, 0).toFixed(1)),
    // Durations are only exact once the video has been rendered and the timeline resolved.
    exact: Boolean(storyboard.doc.resolved),
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const sceneIds = (Array.isArray(body?.sceneIds) ? body.sceneIds : []).filter(
    (s: unknown): s is string => typeof s === "string"
  );

  const storyboard = await getStoryboard(id);
  if (!storyboard) return NextResponse.json({ error: "Storyboard not found" }, { status: 404 });

  const source = await getProject(storyboard.projectId);
  if (!source) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  let highlight;
  try {
    highlight = buildHighlight(storyboard.doc, sceneIds);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not build the Short" }, { status: 400 });
  }

  // Vertical only. A Short is a 9:16 format by definition, and rendering the landscape cut of a
  // 45-second excerpt would produce a file with no home.
  const project = await createProject({
    title: `${source.title} — Short`,
    scopeKind: source.scopeKind,
    scopeRef: source.scopeRef,
    grouping: "single_video",
    themeKey: source.themeKey,
    bgmTrackId: source.bgmTrackId,
    narrationLangs: [storyboard.narrationLang as NarrationLang],
    formats: ["vertical"],
    tone: source.tone,
    includeBroll: false,
    pacing: source.pacing,
    voices: source.voices,
    captions: source.captions,
    branding: source.branding,
    createdBy: admin.email,
  });

  const created = await insertStoryboardVersion({
    projectId: project.id,
    narrationLang: storyboard.narrationLang as NarrationLang,
    source: "imported",
    doc: { ...highlight.doc, projectId: project.id },
    // Cut by hand from something already reviewed, so it arrives approved rather than sending you
    // back through the gate for a subset of lines you have already read.
    approvalStatus: "approved",
    createdBy: admin.email,
  });

  await setProjectStatus(project.id, "script_ready");

  // 'auto_short' has been an allowed kind since migration 141 and was never written.
  await recordGenerationRun({
    projectId: project.id,
    storyboardId: created.id,
    kind: "auto_short",
    narrationLang: storyboard.narrationLang,
    model: "none",
    promptKey: "none",
    systemPrompt: "Cut from an existing storyboard — no model call.",
    userMessage: JSON.stringify({ sourceStoryboardId: id, sceneIds }),
    estimatedSeconds: highlight.seconds,
    estimatedCostUsd: 0,
    status: "ok",
    durationMs: 0,
    requestedBy: admin.email,
  });

  await logEvent({
    projectId: project.id,
    storyboardId: created.id,
    actor: admin.email,
    eventType: "highlight_created",
    payload: { sourceProjectId: source.id, sourceStoryboardId: id, scenes: highlight.sceneCount, seconds: highlight.seconds },
  });

  return NextResponse.json({
    project,
    storyboardId: created.id,
    seconds: highlight.seconds,
    sceneCount: highlight.sceneCount,
    warnings: highlight.warnings,
    message:
      `Created a ${Math.round(highlight.seconds)}s Short from ${highlight.sceneCount} scenes. ` +
      `The voiceover is already cached, so rendering it costs render time only.`,
  });
}
