import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { briefFacts, getBrief } from "@/lib/social/briefs";
import { buildSocialRequest, estimateBatchCostUsd, factsForSurface } from "@/lib/social/generate";
import { SOCIAL_LANGS, getRule, isSurfaceId, type SocialLang, type SurfaceId } from "@/lib/social/platforms";

/**
 * Exactly what would be sent, without sending it.
 *
 * Consumes the same `buildSocialRequest()` the generate route does, so the prompt shown here
 * cannot drift from the prompt that runs — the split that makes the video studio's prompt panel
 * trustworthy, applied to the same problem.
 */
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

  const overrides = {
    systemPrompt: typeof body?.systemPrompt === "string" && body.systemPrompt.trim() ? body.systemPrompt : undefined,
    extraInstructions: typeof body?.extraInstructions === "string" ? body.extraInstructions : undefined,
  };

  const facts = briefFacts(brief);
  const previews = await Promise.all(
    surfaces.map(async (surface) => {
      const rule = getRule(surface);
      const passLangs = rule.generation.splitByLanguage ? [langs[0]] : langs;
      const request = await buildSocialRequest(factsForSurface(facts, surface), surface, passLangs, overrides);
      return {
        surface,
        label: rule.label,
        promptKey: request.promptKey,
        systemPrompt: request.systemPrompt,
        userMessage: request.userMessage,
        budgets: request.budgets,
        hashtagRange: request.hashtagRange,
        suggestedHashtags: request.suggestedHashtags,
        // Surfaces that split by language cost one call per language, not one call total.
        calls: rule.generation.splitByLanguage ? langs.length : 1,
        maxTokens: request.maxTokens,
      };
    })
  );

  return NextResponse.json({
    previews,
    estimatedCostUsd: estimateBatchCostUsd(surfaces, langs),
  });
}
