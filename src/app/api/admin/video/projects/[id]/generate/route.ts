import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { insertAiLog } from "@/lib/ai-logs";
import { resolveScope } from "@/lib/video/scopeResolver";
import { generateStoryboard } from "@/lib/video/storyboard";
import {
  getProject,
  insertStoryboardVersion,
  logEvent,
  resolveApprovalMode,
  setProjectStatus,
} from "@/lib/video/projects";
import type { NarrationLang } from "@/lib/video/types";

/**
 * Generates (or regenerates) the narration script for one narration language.
 *
 * One DeepSeek call per language, which comfortably fits Netlify's ~10s budget — unlike
 * rendering, this genuinely can run in a route. A project with several languages is generated
 * one request at a time by the client so no single invocation stacks multiple LLM round-trips.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const lang = (body?.narrationLang ?? project.narrationLangs[0]) as NarrationLang;
  if (!project.narrationLangs.includes(lang)) {
    return NextResponse.json({ error: `This project does not include ${lang} narration.` }, { status: 400 });
  }
  // A regenerate can steer tone/length without editing the project itself.
  const toneOverride = typeof body?.tone === "string" && body.tone.trim() ? body.tone.trim() : null;
  const isRegenerate = Boolean(body?.regenerate);

  await setProjectStatus(id, "generating_script");

  try {
    const snapshot = await resolveScope(project.scopeKind, project.scopeRef);
    const generated = await generateStoryboard(snapshot, {
      projectId: id,
      narrationLang: lang,
      themeKey: project.themeKey,
      tone: toneOverride ?? project.tone,
      targetDurationSeconds: project.targetDurationSeconds,
      bgm: project.bgmTrackId ? { trackId: project.bgmTrackId, gainDb: -18, duckDb: -12 } : undefined,
      includeBroll: project.includeBroll,
      siteName: "JapaneseWithAvnish",
      siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://japanesewithavnish.com").replace(/^https?:\/\//, ""),
    });

    // The policy decides whether this can go straight to rendering or has to be read first.
    const mode = await resolveApprovalMode({
      scopeKind: project.scopeKind,
      contentType: project.scopeRef.contentType ?? snapshot.items[0]?.kind ?? "*",
      format: project.formats[0] ?? "*",
      publishTargetKind: "site",
    });
    const approvalStatus = mode === "auto" ? "approved" : "pending_review";

    const storyboard = await insertStoryboardVersion({
      projectId: id,
      narrationLang: lang,
      source: isRegenerate ? "regenerated" : "ai_generated",
      doc: generated.storyboard,
      contentSnapshot: snapshot,
      approvalStatus,
      llmModel: generated.model,
      promptKey: generated.promptKey,
      promptTokens: generated.usage.promptTokens,
      completionTokens: generated.usage.completionTokens,
      estimatedCostUsd: generated.estimatedCostUsd,
      createdBy: admin.email,
    });

    await setProjectStatus(id, approvalStatus === "approved" ? "script_ready" : "script_pending_review");

    // Same AI audit trail as every other generated-content path in the admin.
    await insertAiLog({
      log_type: "video_narration",
      content_type: project.scopeRef.contentType ?? snapshot.items[0]?.kind ?? "video",
      entity_type: "video_project",
      entity_id: id,
      model_used: generated.model,
      prompt_sent: `${generated.promptKey} (${lang}, ${generated.storyboard.scenes.length} scenes) — ${project.title}`,
      result_preview: generated.storyboard.scenes
        .flatMap((s) => s.narration.filter((n) => n.lang !== "ja").map((n) => n.text))
        .join(" / "),
      result_metadata: {
        storyboardId: storyboard.id,
        version: storyboard.version,
        narrationLang: lang,
        promptTokens: generated.usage.promptTokens,
        completionTokens: generated.usage.completionTokens,
        estimatedCostUsd: generated.estimatedCostUsd,
      },
      admin_email: admin.email,
    });

    await logEvent({
      projectId: id,
      storyboardId: storyboard.id,
      actor: admin.email,
      eventType: isRegenerate ? "script_regenerated" : "script_generated",
      payload: {
        narrationLang: lang,
        version: storyboard.version,
        scenes: generated.storyboard.scenes.length,
        approvalMode: mode,
        estimatedCostUsd: generated.estimatedCostUsd,
      },
    });

    return NextResponse.json({ storyboard, approvalMode: mode });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Script generation failed";
    await setProjectStatus(id, "failed", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
