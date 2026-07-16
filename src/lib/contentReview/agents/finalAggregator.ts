import { getReviewAgentPrompt } from "../agentPrompts";
import { wrapUntrustedContent } from "../promptFraming";
import type { DraftFinding, TokenUsage } from "../types";

export interface AggregatorResult {
  summary: string;
  /** Indices into the `findings` array passed in — jobRunner.ts maps these to the real
   * DB-generated finding ids (same order) since this function only sees DraftFinding[]. */
  duplicateGroupIndices: number[][];
  usage: TokenUsage;
}

/** Not registered via registerAgent()/the generic per-snapshot agent loop: this agent's
 * whole job is synthesizing the OTHER agents' findings for this run, so it needs the
 * accumulated findings list as input, not just the content snapshot. jobRunner.ts calls
 * this directly after every other agent has run. The overall score itself is computed
 * deterministically in jobRunner.ts's scoreFindings() (per the founder's spec: score is a
 * fixed formula, only the prose summary + duplicate grouping are genuinely LLM judgment
 * calls) — this function produces both. Findings are reused as-is; this repurposes
 * callReviewAgent()'s JSON-array plumbing for a differently-shaped single-object response,
 * so it parses the response directly rather than going through the findings validator. */
export async function summarizeFindings(
  findings: DraftFinding[],
  config: { modelName: string; temperature: number } = { modelName: "deepseek-chat", temperature: 0.2 }
): Promise<AggregatorResult> {
  const zeroUsage: TokenUsage = { promptTokens: 0, completionTokens: 0 };
  if (findings.length === 0) {
    return { summary: "No issues found in this review pass.", duplicateGroupIndices: [], usage: zeroUsage };
  }

  const systemPrompt = await getReviewAgentPrompt("final_aggregator");
  const userMessage = wrapUntrustedContent(
    "findings",
    findings.map((f, i) => ({ index: i, severity: f.severity, category: f.category, title: f.title, description: f.description }))
  );

  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    return {
      summary: `${findings.length} finding(s) recorded (summary unavailable — DEEPSEEK_API_KEY not set).`,
      duplicateGroupIndices: [],
      usage: zeroUsage,
    };
  }

  try {
    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: config.modelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: config.temperature,
        max_tokens: 500,
      }),
    });
    if (!res.ok) throw new Error(`DeepSeek ${res.status}`);
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const usage: TokenUsage = {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
    };
    const raw = (data.choices?.[0]?.message?.content ?? "").replace(/^```\w*\n?|\n?```$/g, "").trim();
    const parsed = JSON.parse(raw) as { summary?: string; duplicate_groups?: unknown };
    const duplicateGroupIndices = Array.isArray(parsed.duplicate_groups)
      ? parsed.duplicate_groups
          .filter((g): g is number[] => Array.isArray(g) && g.every((n) => typeof n === "number" && n >= 0 && n < findings.length))
          .filter((g) => g.length > 1)
      : [];
    return { summary: parsed.summary?.trim() || `${findings.length} finding(s) recorded.`, duplicateGroupIndices, usage };
  } catch (err) {
    console.error("[content-review] final aggregator summary failed:", err);
    const criticals = findings.filter((f) => f.severity === "critical").length;
    const majors = findings.filter((f) => f.severity === "major").length;
    return {
      summary: `${findings.length} finding(s) recorded (${criticals} critical, ${majors} major). Summary generation failed — see individual findings.`,
      duplicateGroupIndices: [],
      usage: zeroUsage,
    };
  }
}
