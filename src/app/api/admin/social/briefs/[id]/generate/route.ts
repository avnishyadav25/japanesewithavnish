import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { insertAiLog } from "@/lib/ai-logs";
import {
  briefFacts,
  generationSpendUsd,
  getBrief,
  recordGenerationRun,
  saveVariant,
  setBriefStatus,
} from "@/lib/social/briefs";
import {
  estimateBatchCostUsd,
  factsForSurface,
  generateSurface,
  newBatchId,
  repairSurfaceLang,
} from "@/lib/social/generate";
import { SOCIAL_LANGS, getRule, isSurfaceId, type SocialLang, type SurfaceId } from "@/lib/social/platforms";

/**
 * Generates copy for one or more surfaces.
 *
 * One LLM call per surface, both languages in the same call where the payload is small enough —
 * see the reasoning in src/lib/social/generate.ts. A language that comes back missing triggers
 * one targeted repair call rather than failing the surface.
 */

/** Mirrors DAILY_COST_CAP_USD in src/lib/contentReview/jobRunner.ts. "Generate everything" across
 *  a batch of briefs is a lot of calls behind one click, so there is a circuit breaker. */
const DAILY_COST_CAP_USD = Number(process.env.SOCIAL_DAILY_COST_CAP_USD) || 3;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const brief = await getBrief(id);
  if (!brief) return NextResponse.json({ error: "Brief not found" }, { status: 404 });

  const body = await req.json().catch(() => null);

  const surfaceInput: unknown[] = Array.isArray(body?.surfaces) ? body.surfaces : [];
  const surfaces: SurfaceId[] = surfaceInput.filter((s): s is SurfaceId => typeof s === "string" && isSurfaceId(s));
  if (surfaces.length === 0) {
    return NextResponse.json({ error: "At least one valid surface is required" }, { status: 400 });
  }

  const langInput: unknown[] = Array.isArray(body?.langs) ? body.langs : [...SOCIAL_LANGS];
  const langs: SocialLang[] = langInput.filter((l): l is SocialLang => l === "en" || l === "hinglish");
  if (langs.length === 0) return NextResponse.json({ error: "At least one language is required" }, { status: 400 });

  const spent = await generationSpendUsd(24);
  const forecast = estimateBatchCostUsd(surfaces, langs);
  if (spent + forecast > DAILY_COST_CAP_USD) {
    return NextResponse.json(
      {
        error: `Daily generation cap reached: $${spent.toFixed(3)} spent in the last 24h, this batch would add about $${forecast.toFixed(3)}, cap is $${DAILY_COST_CAP_USD}. Raise SOCIAL_DAILY_COST_CAP_USD if this is expected.`,
      },
      { status: 429 }
    );
  }

  const overrides = {
    systemPrompt: typeof body?.systemPrompt === "string" && body.systemPrompt.trim() ? body.systemPrompt : undefined,
    extraInstructions: typeof body?.extraInstructions === "string" ? body.extraInstructions : undefined,
  };

  await setBriefStatus(brief.id, "generating");
  const batchId = newBatchId();
  const facts = briefFacts(brief);

  const results: {
    surface: SurfaceId;
    status: string;
    langs: SocialLang[];
    violations: number;
    error?: string;
  }[] = [];
  let totalCost = 0;

  for (const surface of surfaces) {
    const rule = getRule(surface);
    const surfaceFacts = factsForSurface(facts, surface);
    // Large payloads (carousels, threads, articles) get one call per language; small ones get
    // both at once, which keeps the two variants saying the same thing.
    const passes: SocialLang[][] = rule.generation.splitByLanguage ? langs.map((l) => [l]) : [langs];

    const producedLangs: SocialLang[] = [];
    let violations = 0;
    let lastStatus = "ok";
    let lastError: string | undefined;

    for (const pass of passes) {
      const generated = await generateSurface(surfaceFacts, surface, pass, overrides);
      totalCost += generated.estimatedCostUsd;

      const variantIds: string[] = [];
      for (const lang of pass) {
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
          createdBy: admin.email,
        });
        variantIds.push(saved.id);
        producedLangs.push(lang);
        violations += variant.violations.length;
      }

      await recordGenerationRun({
        briefId: brief.id,
        batchId,
        variantIds,
        kind: "surface",
        surface,
        langs: pass,
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
        requestedBy: admin.email,
      });

      lastStatus = generated.status;
      lastError = generated.errorMessage ?? undefined;

      // One targeted retry for a language the model dropped. This is
      // scripts/fill-missing-social-platforms.ts promoted into the engine.
      for (const missing of generated.missingLangs) {
        const repaired = await repairSurfaceLang(surfaceFacts, surface, missing, overrides);
        totalCost += repaired.estimatedCostUsd;
        const variant = repaired.variants[missing];
        const repairedIds: string[] = [];
        if (variant) {
          const saved = await saveVariant({
            briefId: brief.id,
            surface,
            lang: missing,
            content: variant.content,
            hashtags: variant.hashtags,
            clampReport: variant.violations,
            source: "ai_generated",
            createdBy: admin.email,
          });
          repairedIds.push(saved.id);
          producedLangs.push(missing);
          violations += variant.violations.length;
        }
        await recordGenerationRun({
          briefId: brief.id,
          batchId,
          variantIds: repairedIds,
          kind: "repair",
          surface,
          langs: [missing],
          model: repaired.model,
          promptKey: repaired.promptKey,
          systemPrompt: repaired.request.systemPrompt,
          userMessage: repaired.request.userMessage,
          rawResponse: repaired.rawResponse,
          promptTokens: repaired.usage.promptTokens,
          completionTokens: repaired.usage.completionTokens,
          estimatedCostUsd: repaired.estimatedCostUsd,
          status: variant ? "repaired" : repaired.status,
          errorMessage: repaired.errorMessage,
          durationMs: repaired.durationMs,
          requestedBy: admin.email,
        });
      }
    }

    results.push({
      surface,
      status: producedLangs.length > 0 ? lastStatus : "failed",
      langs: producedLangs,
      violations,
      error: producedLangs.length === 0 ? lastError : undefined,
    });
  }

  await setBriefStatus(brief.id, "ready");

  // Also written to the unified feed at /admin/ai-logs. The real cost figures live in
  // social_generation_runs, which has first-class numeric columns; ai_generation_logs has none.
  await insertAiLog({
    log_type: "social_generate",
    content_type: brief.contentType ?? "social",
    entity_type: "social_brief",
    entity_id: brief.id,
    model_used: "deepseek-chat",
    prompt_sent: surfaces.join(", "),
    result_preview: results.map((r) => `${r.surface}: ${r.langs.join("+") || "none"}`).join("; "),
    result_metadata: { batchId, estimatedCostUsd: totalCost, results },
    admin_email: admin.email,
  }).catch(() => {});

  return NextResponse.json({ batchId, estimatedCostUsd: totalCost, results });
}
