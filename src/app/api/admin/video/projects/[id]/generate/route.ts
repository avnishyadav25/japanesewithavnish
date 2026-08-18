import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { insertAiLog } from "@/lib/ai-logs";
import { resolveScope } from "@/lib/video/scopeResolver";
import {
  MAX_BATCHES_PER_REQUEST,
  buildGenerationRequest,
  generateStoryboard,
  outroSiteUrl,
  planGenerationBatches,
} from "@/lib/video/storyboard";
import { resolvePacing } from "@/lib/video/pacing";
import { recordGenerationRun, snapshotStoryboardState } from "@/lib/video/audit";
import { triggerWorkflow } from "@/lib/video/dispatch";
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
 * A small scope is one DeepSeek call and fits comfortably. A large one is chunked into
 * scene-aligned batches — and that is where the ceiling bites: chunking makes a whole-level
 * scope CORRECT (2,820 slots that a single 8,000-token response could never have carried) but
 * not survivable, at 71 calls against a ~30 s function ceiling. So an oversized scope is refused
 * before anything is spent, with the alternative named. Timing out halfway would leave the
 * project stuck in generating_script, which is a state the database already contains once.
 *
 * A project with several languages is generated one request at a time by the client so no single
 * invocation stacks multiple LLM round-trips.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  // Captured before anything overwrites it, so a finished project can be put back afterwards.
  const previousStatus = project.status;

  const body = await req.json().catch(() => ({}));
  const lang = (body?.narrationLang ?? project.narrationLangs[0]) as NarrationLang;
  if (!project.narrationLangs.includes(lang)) {
    return NextResponse.json({ error: `This project does not include ${lang} narration.` }, { status: 400 });
  }
  // A regenerate can steer tone/length without editing the project itself.
  const toneOverride = typeof body?.tone === "string" && body.tone.trim() ? body.tone.trim() : null;
  const isRegenerate = Boolean(body?.regenerate);

  try {
    const snapshot = await resolveScope(project.scopeKind, project.scopeRef);
    // Pacing is what makes the requested duration binding — see src/lib/video/pacing.ts.
    const pacing = resolvePacing(
      (body?.pacing as Record<string, number> | undefined) ?? project.pacing,
      snapshot.items[0]?.kind
    );
    // Cost the request before committing to it. buildGenerationRequest is the same builder
    // generateStoryboard uses, so this counts the batches that would actually run — and it makes
    // no network call, so refusing here is free.
    const planned = await buildGenerationRequest(snapshot, {
      projectId: id,
      narrationLang: lang,
      themeKey: project.themeKey,
      pacing,
      voices: project.voices,
      tone: toneOverride ?? project.tone,
      includeBroll: project.includeBroll,
      siteName: "JapaneseWithAvnish",
      siteUrl: outroSiteUrl(),
    });
    const batchCount = planGenerationBatches(planned.skeleton.scenes, planned.skeleton.blanks).length;

    if (batchCount > MAX_BATCHES_PER_REQUEST) {
      // Too big for a request, but not too big full stop — a runner has no function ceiling.
      // `onCi: true` asks for it to be generated there instead of refusing outright.
      if (body?.onCi === true) {
        await setProjectStatus(id, "generating_script");
        const dispatch = await triggerWorkflow("video-script", { projectId: id, narrationLang: lang });
        await logEvent({
          projectId: id,
          actor: admin.email,
          eventType: "script_dispatched_ci",
          payload: { slots: planned.skeleton.blanks.length, batches: batchCount, dispatch },
        });
        return NextResponse.json({
          dispatched: true,
          slots: planned.skeleton.blanks.length,
          batches: batchCount,
          dispatch,
          message: dispatch.ok
            ? `Generating ${planned.skeleton.blanks.length} lines on GitHub Actions — this page updates when it finishes.`
            : `Could not reach GitHub: ${dispatch.detail}`,
        });
      }

      return NextResponse.json(
        {
          error:
            `This scope needs ${planned.skeleton.blanks.length} narration slots across ${batchCount} ` +
            `model calls, which will not finish inside the ~30s request limit.`,
          slots: planned.skeleton.blanks.length,
          batches: batchCount,
          maxBatches: MAX_BATCHES_PER_REQUEST,
          // The client offers this as a button rather than telling you to shrink the scope.
          canGenerateOnCi: true,
        },
        { status: 413 }
      );
    }

    // Only now does the project claim to be generating: setting it before the guard left an
    // oversized project permanently mid-flight after a refusal that cost nothing.
    await setProjectStatus(id, "generating_script");

    const generated = await generateStoryboard(
      snapshot,
      {
        projectId: id,
        narrationLang: lang,
        themeKey: project.themeKey,
        pacing,
        voices: project.voices,
        tone: toneOverride ?? project.tone,
        bgm: project.bgmTrackId ? { trackId: project.bgmTrackId, gainDb: -18, duckDb: -12 } : undefined,
        includeBroll: project.includeBroll,
        siteName: "JapaneseWithAvnish",
        siteUrl: outroSiteUrl(),
      },
      {
        systemPrompt: typeof body?.systemPrompt === "string" ? body.systemPrompt : undefined,
        slots: (body?.slotOverrides as Record<string, { hint?: string; maxWords?: number }>) ?? undefined,
      }
    );

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

    // Verbatim record of what was sent and what came back, so a good run can be reproduced
    // and a bad one diagnosed. Token counts alone cannot tell you why.
    await recordGenerationRun({
      projectId: id,
      storyboardId: storyboard.id,
      kind: "full_script",
      narrationLang: lang,
      model: generated.model,
      promptKey: generated.promptKey,
      systemPrompt: generated.request.systemPrompt,
      userMessage: generated.request.userMessage,
      rawResponse: generated.rawResponse,
      slots: generated.request.slots,
      pacing,
      estimatedSeconds: generated.request.estimatedSeconds,
      promptTokens: generated.usage.promptTokens,
      completionTokens: generated.usage.completionTokens,
      estimatedCostUsd: generated.estimatedCostUsd,
      durationMs: generated.durationMs,
      requestedBy: admin.email,
    });

    await snapshotStoryboardState({
      storyboardId: storyboard.id,
      projectId: id,
      fromState: "draft",
      toState: approvalStatus === "approved" ? "script_ready" : "script_pending_review",
      doc: generated.storyboard,
      actor: admin.email,
    });

    // A project that was already finished stays finished.
    //
    // This route used to leave every regenerate at script_ready/script_pending_review, so
    // rewriting one line of narration on a rendered project dropped it out of `render_ready` —
    // and the only ways back are rendering again or approving a render. The existing renders were
    // never touched (`is_current` stays true), so the MP4 was still there; only the status that
    // the "Done" filter and the batch panel's rendered count read was lost.
    //
    // Restored only when the new script needs no review AND a current render still exists. A
    // script awaiting a human read must not claim the project is done.
    const currentRenders = (await sql`
      SELECT COUNT(*)::int AS n FROM video_renders
      WHERE project_id = ${id}::uuid AND is_current AND approval_status <> 'rejected'
    `) as { n: number }[];
    const stillRendered = (currentRenders[0]?.n ?? 0) > 0;

    const nextStatus =
      approvalStatus === "approved"
        ? stillRendered && previousStatus === "render_ready"
          ? "render_ready"
          : "script_ready"
        : "script_pending_review";
    await setProjectStatus(id, nextStatus);

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
    // A failed run is the one most worth keeping — record it before surfacing the error.
    await recordGenerationRun({
      projectId: id,
      narrationLang: lang,
      model: "deepseek-chat",
      systemPrompt: "(generation failed before or during the call)",
      userMessage: "(see error_message)",
      status: "api_error",
      errorMessage: message,
      requestedBy: admin.email,
    }).catch(() => {});
    await setProjectStatus(id, "failed", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
