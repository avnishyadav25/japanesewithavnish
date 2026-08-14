/**
 * Writes social copy for a render as soon as it finishes.
 *
 * Runs on the worker rather than in a route: generating three surfaces takes 20-30 seconds,
 * which does not fit inside a Netlify function, and the worker is already awake and holding the
 * render's context.
 *
 * Everything here is best-effort. The video is uploaded and recorded before this is called, so a
 * failure costs some captions, never a render.
 */
import { SOCIAL_LANGS, type SurfaceId } from "../../../src/lib/social/platforms";

/**
 * The default set.
 *
 * Three surfaces, not fifteen: these are the ones a vertical short is actually posted to, and
 * generating all of them for a video that might never go out is spending tokens on a maybe.
 * Everything else is one click away in the brief workspace.
 */
const DEFAULT_SURFACES: SurfaceId[] = ["instagram.reel", "youtube.short", "x.post"];

export async function generateSocialForRender(params: {
  renderId: string;
  actor: string;
  log: (message: string) => Promise<void>;
}): Promise<void> {
  const { renderId, actor, log } = params;

  if (process.env.SOCIAL_AUTOGEN === "off") {
    await log("Social copy: skipped (SOCIAL_AUTOGEN=off)");
    return;
  }
  if (!process.env.DEEPSEEK_API_KEY?.trim()) {
    await log("Social copy: skipped (DEEPSEEK_API_KEY not set)");
    return;
  }

  // Imported lazily so a worker that never reaches this point does not pay to load the
  // generation stack, and so an import error here cannot break the render path at startup.
  const { briefForRender, briefFacts, saveVariant, recordGenerationRun, generationSpendUsd } = await import(
    "../../../src/lib/social/briefs"
  );
  const { generateSurface, factsForSurface, newBatchId } = await import("../../../src/lib/social/generate");

  // Same circuit breaker the interactive route uses. A queue of thirty renders would otherwise
  // generate ninety times unattended.
  const cap = Number(process.env.SOCIAL_DAILY_COST_CAP_USD) || 3;
  const spent = await generationSpendUsd(24);
  if (spent >= cap) {
    await log(`Social copy: skipped — $${spent.toFixed(3)} spent in 24h, cap is $${cap}`);
    return;
  }

  const brief = await briefForRender(renderId, actor);
  const facts = briefFacts(brief);
  const batchId = newBatchId();

  let written = 0;
  let cost = 0;

  for (const surface of DEFAULT_SURFACES) {
    const generated = await generateSurface(factsForSurface(facts, surface), surface, [...SOCIAL_LANGS]);
    cost += generated.estimatedCostUsd;

    const variantIds: string[] = [];
    for (const lang of SOCIAL_LANGS) {
      const variant = generated.variants[lang];
      if (!variant) continue;
      const saved = await saveVariant({
        briefId: brief.id,
        surface,
        lang,
        content: variant.content,
        hashtags: variant.hashtags,
        clampReport: variant.violations,
        source: "ai_generated",
        createdBy: actor,
      });
      variantIds.push(saved.id);
      written += 1;
    }

    await recordGenerationRun({
      briefId: brief.id,
      batchId,
      variantIds,
      kind: "surface",
      surface,
      langs: [...SOCIAL_LANGS],
      model: generated.model,
      promptKey: generated.promptKey,
      systemPrompt: generated.request.systemPrompt,
      userMessage: generated.request.userMessage,
      rawResponse: generated.rawResponse,
      promptTokens: generated.usage.promptTokens,
      completionTokens: generated.usage.completionTokens,
      estimatedCostUsd: generated.estimatedCostUsd,
      status: generated.status,
      errorMessage: generated.errorMessage,
      durationMs: generated.durationMs,
      requestedBy: actor,
    });
  }

  await log(
    `Social copy ready — ${written} variant${written === 1 ? "" : "s"} across ${DEFAULT_SURFACES.length} surfaces ($${cost.toFixed(4)}). Review at /admin/social/briefs/${brief.id}`
  );
}
