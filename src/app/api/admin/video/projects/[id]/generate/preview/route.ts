import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { resolveScope } from "@/lib/video/scopeResolver";
import { buildGenerationRequest, outroSiteUrl } from "@/lib/video/storyboard";
import { estimateTtsCost, formatDuration, resolvePacing } from "@/lib/video/pacing";
import { getProject } from "@/lib/video/projects";
import { DEFAULT_VOICES } from "@/lib/video/tts";
import type { NarrationLang, PacingConfig } from "@/lib/video/types";

/**
 * Everything the model would be sent, without sending it.
 *
 * Exists so "Generate script" stops being a black box: you see the resolved system prompt, every
 * narration slot with its computed word budget, the content that was pulled, and what it will
 * cost — and can change any of it before spending a call. `buildGenerationRequest` is the same
 * function the real generation uses, so the preview cannot drift from what actually runs.
 *
 * Costs nothing: no LLM call, no TTS.
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

  try {
    const snapshot = await resolveScope(project.scopeKind, project.scopeRef);
    const kind = snapshot.items[0]?.kind;
    // Same bug family as the generate route: this preview resolved pacing without the preset, so
    // it previewed a lesson for a Shorts project — wrong scene count, wrong length, wrong budget.
    const stylePreset = project.stylePreset ?? "lesson";
    const pacing = resolvePacing(
      (body?.pacing as Partial<PacingConfig> | undefined) ?? project.pacing,
      kind,
      stylePreset
    );

    const { request, skeleton } = await buildGenerationRequest(snapshot, {
      projectId: id,
      narrationLang: lang,
      themeKey: project.themeKey,
      pacing,
      stylePreset,
      voices: project.voices,
      tone: typeof body?.tone === "string" ? body.tone : project.tone,
      includeBroll: project.includeBroll,
      siteName: "JapaneseWithAvnish",
      siteUrl: outroSiteUrl(),
    });

    const voices = { ...DEFAULT_VOICES, ...(project.voices ?? {}) };

    return NextResponse.json({
      systemPrompt: request.systemPrompt,
      userMessage: request.userMessage,
      slots: request.slots,
      promptKey: request.promptKey,
      model: request.model,
      pacing,
      voices,
      estimate: {
        itemCount: request.itemCount,
        sceneCount: request.sceneCount,
        seconds: request.estimatedSeconds,
        readable: formatDuration(request.estimatedSeconds),
        // Every segment is uncached at this point, so this is the full first-render cost.
        ttsCostUsd: estimateTtsCost(skeleton.scenes, voices),
        // ~4 chars per token is the usual rule of thumb for English prompts.
        approxPromptTokens: Math.round((request.systemPrompt.length + request.userMessage.length) / 4),
      },
      // Lets the panel warn about thin source material before a script is written rather than
      // after you have watched a video with nothing in it.
      contentWarnings: buildWarnings(snapshot.items),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not build the request" },
      { status: 400 }
    );
  }
}

function buildWarnings(items: { title: string; examples: unknown[]; data: Record<string, unknown> }[]): string[] {
  const warnings: string[] = [];

  const noExamples = items.filter((i) => i.examples.length === 0).length;
  if (noExamples > 0) {
    warnings.push(
      `${noExamples} of ${items.length} items have no example sentences — those scenes will be explanation-only.`
    );
  }

  // Mixed grammar notation still works, but until the backfill runs the Japanese voice only
  // gets the extracted Japanese, which is worth knowing before you listen to it.
  const unbackfilled = items.filter(
    (i) => typeof i.data.pattern === "string" && /[A-Za-z]/.test(i.data.pattern) && !i.data.pattern_spoken
  ).length;
  if (unbackfilled > 0) {
    warnings.push(
      `${unbackfilled} grammar patterns mix English and Japanese and have no curated spoken form yet. ` +
        `The Japanese voice will say only the Japanese part. Run scripts/backfill-grammar-spoken.ts to curate them.`
    );
  }

  const noStrokes = items.filter(
    (i) => i.data.character && (!Array.isArray(i.data.stroke_data) || i.data.stroke_data.length === 0)
  ).length;
  if (noStrokes > 0) {
    warnings.push(`${noStrokes} kanji have no stroke data — those scenes show the plain glyph instead of an animation.`);
  }

  return warnings;
}
