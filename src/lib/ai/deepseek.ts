/**
 * One DeepSeek client.
 *
 * There are around twenty hand-rolled copies of this fetch across the codebase, and exactly one
 * of them — src/lib/video/storyboard.ts — asks for `response_format: {type:"json_object"}`. That
 * is also the only one that has never needed regex repair for trailing commas and stray prose.
 * The correlation is not a coincidence, so this client always uses JSON mode.
 *
 * This is deliberately NOT a refactor of the existing twenty call sites; that is a separate
 * change with its own risk. New code uses this.
 *
 * No `next/*` imports — usable from scripts and the worker as well as route handlers.
 */

export const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";
export const CHAT_MODEL = "deepseek-chat";

/**
 * deepseek-chat cache-miss pricing, USD per token. Mirrors the constants in
 * src/lib/video/storyboard.ts and src/lib/contentReview/jobRunner.ts.
 *
 * These are estimates for reporting, not billing truth.
 */
export const PROMPT_COST_PER_TOKEN = 0.14 / 1_000_000;
export const COMPLETION_COST_PER_TOKEN = 0.28 / 1_000_000;

export function estimateCostUsd(promptTokens: number, completionTokens: number): number {
  return promptTokens * PROMPT_COST_PER_TOKEN + completionTokens * COMPLETION_COST_PER_TOKEN;
}

export interface DeepSeekJsonRequest {
  systemPrompt: string;
  userMessage: string;
  maxTokens: number;
  temperature?: number;
  /** Aborts a request that has stopped producing tokens. Netlify will kill the function at ~10s
   * anyway; this makes the failure legible instead of a truncated response. */
  timeoutMs?: number;
}

export interface DeepSeekJsonResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  model: string;
  durationMs: number;
}

export class DeepSeekError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable: boolean = false
  ) {
    super(message);
    this.name = "DeepSeekError";
  }
}

export function deepSeekConfigured(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY?.trim());
}

export async function callDeepSeekJson(req: DeepSeekJsonRequest): Promise<DeepSeekJsonResult> {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) throw new DeepSeekError("DEEPSEEK_API_KEY is not set");

  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = req.timeoutMs ? setTimeout(() => controller.abort(), req.timeoutMs) : null;

  let res: Response;
  try {
    res = await fetch(DEEPSEEK_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [
          { role: "system", content: req.systemPrompt },
          { role: "user", content: req.userMessage },
        ],
        temperature: req.temperature ?? 0.7,
        max_tokens: req.maxTokens,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new DeepSeekError(`Timed out after ${req.timeoutMs}ms`, undefined, true);
    }
    throw new DeepSeekError(err instanceof Error ? err.message : String(err), undefined, true);
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let message = `DeepSeek returned ${res.status}`;
    try {
      message = JSON.parse(body)?.error?.message || message;
    } catch {
      if (body) message = `${message}: ${body.slice(0, 300)}`;
    }
    // 429 and 5xx are worth another attempt; 400-level ones mean the request itself is wrong.
    throw new DeepSeekError(message, res.status, res.status === 429 || res.status >= 500);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const text = data.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new DeepSeekError("DeepSeek returned an empty completion");

  const promptTokens = data.usage?.prompt_tokens ?? 0;
  const completionTokens = data.usage?.completion_tokens ?? 0;

  return {
    text,
    promptTokens,
    completionTokens,
    estimatedCostUsd: estimateCostUsd(promptTokens, completionTokens),
    model: CHAT_MODEL,
    durationMs: Date.now() - startedAt,
  };
}

/**
 * Parses a JSON-mode response.
 *
 * JSON mode makes this reliable enough not to need the repair regexes that
 * /api/ai/social-pack carries, but a fenced block still slips through occasionally, so that one
 * case is handled. Anything worse is a real failure and should be recorded as one rather than
 * patched over — a silently "repaired" response is how a missing field becomes a mystery later.
 */
export function parseJsonResponse<T = unknown>(text: string): T {
  const trimmed = text.trim();
  const unfenced = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim()
    : trimmed;
  return JSON.parse(unfenced) as T;
}
