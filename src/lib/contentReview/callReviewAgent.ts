import { REVIEW_SEVERITIES, type DraftFinding, type ReviewSeverity, type TokenUsage } from "./types";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";
const CHAT_MODEL = "deepseek-chat";

function isReviewSeverity(v: unknown): v is ReviewSeverity {
  return typeof v === "string" && (REVIEW_SEVERITIES as readonly string[]).includes(v);
}

/** Drops findings missing required fields rather than coercing them, mirroring
 * src/lib/ai/jsonItemValidators.ts's filterValidItems() philosophy — a malformed finding
 * should disappear, not get silently stored as blank/garbage data. */
function validateFindings(arr: unknown): DraftFinding[] {
  if (!Array.isArray(arr)) return [];
  const out: DraftFinding[] = [];
  for (const raw of arr) {
    if (!raw || typeof raw !== "object") continue;
    const obj = raw as Record<string, unknown>;
    if (!isReviewSeverity(obj.severity)) continue;
    if (typeof obj.category !== "string" || !obj.category.trim()) continue;
    if (typeof obj.title !== "string" || !obj.title.trim()) continue;
    if (typeof obj.description !== "string" || !obj.description.trim()) continue;
    out.push({
      severity: obj.severity,
      category: obj.category.trim(),
      fieldName: typeof obj.field_name === "string" ? obj.field_name : null,
      originalValue: obj.original_value,
      suggestedValue: obj.suggested_value,
      title: obj.title.trim(),
      description: obj.description.trim(),
      whyItMatters: typeof obj.why_it_matters === "string" && obj.why_it_matters.trim() ? obj.why_it_matters.trim() : null,
    });
  }
  return out;
}

function tryParseFindings(raw: string): DraftFinding[] | null {
  const cleaned = raw.replace(/^```\w*\n?|\n?```$/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    return validateFindings(parsed);
  } catch {
    return null;
  }
}

function extractUsage(data: { usage?: { prompt_tokens?: number; completion_tokens?: number } }): TokenUsage {
  return {
    promptTokens: data.usage?.prompt_tokens ?? 0,
    completionTokens: data.usage?.completion_tokens ?? 0,
  };
}

function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return { promptTokens: a.promptTokens + b.promptTokens, completionTokens: a.completionTokens + b.completionTokens };
}

export interface CallReviewAgentResult {
  findings: DraftFinding[];
  usage: TokenUsage;
}

/** Calls DeepSeek with a review-agent system prompt + wrapped content, expecting a JSON
 * array of findings back. On parse failure, re-prompts once asking the model to extract
 * valid JSON from its own prior output (same self-healing idea as
 * callDeepSeekWithReasoning in src/lib/ai/deepseek-curriculum.ts, adapted for a findings array).
 * Token usage is accumulated across both calls when the fallback re-prompt fires, since both
 * consume real, billable tokens. */
export async function callReviewAgent(opts: {
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
  model?: string;
  temperature?: number;
}): Promise<CallReviewAgentResult> {
  const zeroUsage: TokenUsage = { promptTokens: 0, completionTokens: 0 };
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    console.error("[content-review] DEEPSEEK_API_KEY not set — skipping LLM pass");
    return { findings: [], usage: zeroUsage };
  }

  // Gap-fix phase 12: model/temperature default to the original hardcoded values so any
  // caller that doesn't pass them (or a content_review_agents row with the pre-migration-111
  // temperature default) behaves exactly as before.
  const { systemPrompt, userMessage, maxTokens = 1500, model = CHAT_MODEL, temperature = 0.1 } = opts;

  const res = await fetch(DEEPSEEK_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    console.error("[content-review] DeepSeek call failed:", res.status, await res.text());
    return { findings: [], usage: zeroUsage };
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  const usage = extractUsage(data);
  const raw = data.choices?.[0]?.message?.content ?? "";
  const parsed = tryParseFindings(raw);
  if (parsed !== null) return { findings: parsed, usage };

  // Self-healing re-prompt: ask the chat model to extract valid JSON from its own output.
  const fallbackRes = await fetch(DEEPSEEK_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [
        {
          role: "user",
          content: `Extract a valid JSON array from the following text. Return ONLY the JSON array, no markdown, no explanation.\n\n${raw}`,
        },
      ],
      temperature: 0,
      max_tokens: maxTokens,
    }),
  });

  if (!fallbackRes.ok) {
    console.error("[content-review] DeepSeek fallback parse failed:", await fallbackRes.text());
    return { findings: [], usage };
  }

  const fallbackData = (await fallbackRes.json()) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  const fallbackUsage = addUsage(usage, extractUsage(fallbackData));
  const fallbackRaw = fallbackData.choices?.[0]?.message?.content ?? "";
  return { findings: tryParseFindings(fallbackRaw) ?? [], usage: fallbackUsage };
}
