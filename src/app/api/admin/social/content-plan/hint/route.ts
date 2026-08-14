import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { getPromptContent } from "@/lib/ai/load-prompts";
import { callDeepSeekJson, parseJsonResponse } from "@/lib/ai/deepseek";
import { recordGenerationRun } from "@/lib/social/briefs";
import { getTopGapCandidates, getUnpostedRenders, getVideoCoverageMatrix } from "@/lib/social/contentPlan";

/**
 * "What should I make next?", answered from real counts.
 *
 * The model is given the coverage matrix and the unposted list and asked to read them back as
 * priorities. It is not asked what is popular, what is trending, or what it thinks — those are
 * questions it would answer confidently and wrongly. Every suggestion has to cite the number it
 * came from, which is checkable.
 */

const FALLBACK_PROMPT = `Suggest what to make next, using only the counts provided.
Cite the specific number behind each suggestion. Give at most three, most valuable first.
If the data shows no meaningful gap, say so rather than inventing work.`;

interface Suggestion {
  title: string;
  reason: string;
  contentType?: string;
  jlptLevel?: string;
  platforms?: string[];
}

export async function POST() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const [matrix, unposted, gaps] = await Promise.all([
    getVideoCoverageMatrix(),
    getUnpostedRenders(10),
    getTopGapCandidates(20),
  ]);

  // Biggest gaps first, capped — the whole matrix would be mostly noise in the context window.
  const notable = matrix
    .filter((c) => c.total >= 5)
    .sort((a, b) => b.withoutVideo - a.withoutVideo)
    .slice(0, 14);

  const systemPrompt = (await getPromptContent("social_plan_hint")) ?? FALLBACK_PROMPT;
  const userMessage = [
    "COVERAGE — published items and how many have appeared in a video:",
    ...notable.map((c) => `${c.level} ${c.contentType}: ${c.total} published, ${c.withVideo} with video, ${c.withoutVideo} without`),
    "",
    unposted.length > 0
      ? `RENDERED BUT NEVER POSTED (${unposted.length}): ${unposted.map((u) => u.title).join(", ")}`
      : "Every rendered video has been posted somewhere.",
    "",
    gaps.length > 0
      ? `EXAMPLE UNCOVERED ITEMS: ${gaps.slice(0, 10).map((g) => `${g.jlptLevel ?? "?"} ${g.contentType} — ${g.title}`).join("; ")}`
      : "",
    "",
    'Return JSON: {"suggestions":[{"title":"…","reason":"… cite the number …","contentType":"vocabulary","jlptLevel":"N5","platforms":["instagram","youtube"]}]}',
  ]
    .filter(Boolean)
    .join("\n");

  const startedAt = Date.now();
  try {
    const result = await callDeepSeekJson({ systemPrompt, userMessage, maxTokens: 900, temperature: 0.4, timeoutMs: 40_000 });
    const parsed = parseJsonResponse<{ suggestions?: Suggestion[] }>(result.text);
    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3) : [];

    await recordGenerationRun({
      briefId: null, batchId: null, kind: "plan_hint", surface: null, langs: [],
      model: result.model, promptKey: "social_plan_hint", systemPrompt, userMessage,
      rawResponse: result.text, promptTokens: result.promptTokens, completionTokens: result.completionTokens,
      estimatedCostUsd: result.estimatedCostUsd, status: "ok", errorMessage: null,
      durationMs: Date.now() - startedAt, requestedBy: admin.email,
    });

    return NextResponse.json({ suggestions, unpostedCount: unposted.length, estimatedCostUsd: result.estimatedCostUsd });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Suggestion failed";
    await recordGenerationRun({
      briefId: null, batchId: null, kind: "plan_hint", surface: null, langs: [],
      model: "deepseek-chat", promptKey: "social_plan_hint", systemPrompt, userMessage,
      rawResponse: null, promptTokens: null, completionTokens: null, estimatedCostUsd: null,
      status: "api_error", errorMessage: message, durationMs: Date.now() - startedAt, requestedBy: admin.email,
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
