import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { getProject, getStoryboard, logEvent } from "@/lib/video/projects";
import { resolveScope } from "@/lib/video/scopeResolver";
import { resolvePacing } from "@/lib/video/pacing";
import { outroSiteUrl, regenerateScene } from "@/lib/video/storyboard";
import { recordGenerationRun } from "@/lib/video/audit";
import { blankScene, isInsertable } from "@/lib/video/blankScene";
import type { NarrationLang, Storyboard } from "@/lib/video/types";

/**
 * Scene-level operations on a storyboard: regenerate one, or insert a blank one.
 *
 * Returns the modified document rather than saving it. The editor already has autosave and an
 * explicit "save as new version", and writing a version per scene edit would leave dozens of
 * numbered versions behind after one session — the same reasoning the draft slot exists for.
 *
 * Regeneration is deliberately narration-only. Everything on screen is built from the database and
 * only the spoken explanation is written by the model; letting a regenerate rewrite a visual would
 * put a hallucinated reading on screen, which is the one failure this pipeline is designed around.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");

  const storyboard = await getStoryboard(id);
  if (!storyboard) return NextResponse.json({ error: "Storyboard not found" }, { status: 404 });

  // The client sends its working copy, so an unsaved edit is not silently discarded by an
  // operation performed against the stored version.
  const doc = (body?.doc as Storyboard | undefined) ?? storyboard.doc;

  // ---- insert a blank scene -------------------------------------------------
  if (action === "insert") {
    const sceneType = String(body?.sceneType ?? "");
    if (!isInsertable(sceneType)) {
      return NextResponse.json(
        { error: `"${sceneType}" cannot be added by hand — its visual comes from the content database.` },
        { status: 400 }
      );
    }
    const at = Number.isInteger(body?.at) ? Math.max(0, Math.min(doc.scenes.length, Number(body.at))) : doc.scenes.length;
    const scene = blankScene(sceneType, storyboard.narrationLang as NarrationLang);
    const scenes = [...doc.scenes.slice(0, at), scene, ...doc.scenes.slice(at)];

    await logEvent({
      projectId: storyboard.projectId,
      storyboardId: id,
      actor: admin.email,
      eventType: "scene_inserted",
      payload: { sceneId: scene.id, sceneType, at },
    });

    return NextResponse.json({
      doc: { ...doc, scenes, resolved: undefined },
      sceneId: scene.id,
      message: "Scene added. Write its narration, or regenerate it to have one written.",
    });
  }

  // ---- regenerate one scene's narration -------------------------------------
  if (action !== "regenerate") {
    return NextResponse.json({ error: 'action must be "regenerate" or "insert"' }, { status: 400 });
  }

  const sceneId = String(body?.sceneId ?? "");
  if (!sceneId) return NextResponse.json({ error: "sceneId is required" }, { status: 400 });

  const project = await getProject(storyboard.projectId);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  try {
    const snapshot = await resolveScope(project.scopeKind, project.scopeRef);
    const config = {
      projectId: project.id,
      narrationLang: storyboard.narrationLang as NarrationLang,
      themeKey: project.themeKey,
      pacing: resolvePacing(project.pacing, snapshot.items[0]?.kind, project.stylePreset ?? "lesson"),
      stylePreset: project.stylePreset ?? "lesson",
      voices: project.voices,
      tone: project.tone,
      includeBroll: project.includeBroll,
      siteName: "JapaneseWithAvnish",
      siteUrl: outroSiteUrl(),
    };

    const result = await regenerateScene({
      storyboard: doc,
      snapshot,
      config,
      sceneId,
      hint: typeof body?.hint === "string" && body.hint.trim() ? body.hint.trim() : undefined,
    });

    // 'scene_regenerate' has been an allowed kind since migration 141 and was never written.
    await recordGenerationRun({
      projectId: project.id,
      storyboardId: id,
      kind: "scene_regenerate",
      narrationLang: storyboard.narrationLang,
      model: result.model,
      promptKey: result.promptKey,
      systemPrompt: result.request.systemPrompt,
      userMessage: result.request.userMessage,
      rawResponse: result.rawResponse,
      slots: result.request.slots,
      pacing: config.pacing,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      estimatedCostUsd: result.estimatedCostUsd,
      status: "ok",
      durationMs: result.durationMs,
      requestedBy: admin.email,
    });

    return NextResponse.json({
      doc: result.storyboard,
      changedSegments: result.changedSegments,
      estimatedCostUsd: result.estimatedCostUsd,
      message:
        result.changedSegments.length === 0
          ? "The model returned the same text — try a steer like \"shorter\" or \"more casual\"."
          : `Rewrote ${result.changedSegments.length} line${result.changedSegments.length === 1 ? "" : "s"}. Save to keep it.`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not regenerate that scene" },
      { status: 400 }
    );
  }
}
