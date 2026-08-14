/**
 * DeepSeek curriculum AI: use reasoning model first, fallback to chat for parsing if needed.
 * Reasoning model (deepseek-reasoner) returns reasoning_content + content; we use content for JSON.
 */

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";
const REASONING_MODEL = "deepseek-reasoner";
const CHAT_MODEL = "deepseek-chat";

export type DeepSeekMessage = { role: "system" | "user" | "assistant"; content: string };

/** Extract final answer from reasoning API response (content, or last part of reasoning_content) */
function extractFinalAnswer(data: {
  choices?: { message?: { content?: string; reasoning_content?: string } }[];
}): string {
  const msg = data.choices?.[0]?.message;
  if (!msg) return "";
  if (typeof msg.content === "string" && msg.content.trim()) return msg.content;
  const reasoning = msg.reasoning_content;
  if (typeof reasoning === "string" && reasoning.trim()) {
    const trimmed = reasoning.trim();
    const lastBlock = trimmed.split(/\n\n+/).pop() ?? trimmed;
    return lastBlock;
  }
  return "";
}

/** Call DeepSeek reasoning model, then try to parse JSON. On failure, call chat model to extract JSON. */
export async function callDeepSeekWithReasoning<T>(opts: {
  systemPrompt: string;
  userMessage: string;
  parse: (obj: unknown) => T;
  maxTokens?: number;
}): Promise<T> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY not set");

  const { systemPrompt, userMessage, parse, maxTokens = 2000 } = opts;

  const tryParse = (raw: string): T | null => {
    const cleaned = raw.replace(/^```\w*\n?|\n?```$/g, "").trim();
    try {
      const obj = JSON.parse(cleaned) as unknown;
      return parse(obj);
    } catch {
      return null;
    }
  };

  const res = await fetch(DEEPSEEK_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: REASONING_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("DeepSeek reasoning:", res.status, errText);
    throw new Error("AI request failed");
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string; reasoning_content?: string } }[] };
  const raw = extractFinalAnswer(data);
  const parsed = tryParse(raw);
  if (parsed !== null) return parsed;

  const fallbackRes = await fetch(DEEPSEEK_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [
        {
          role: "user",
          content: `Extract a valid JSON object from the following text. Return ONLY the JSON object, no markdown, no explanation.\n\n${raw}`,
        },
      ],
      temperature: 0.2,
      max_tokens: maxTokens,
    }),
  });

  if (!fallbackRes.ok) {
    console.error("DeepSeek fallback parse:", await fallbackRes.text());
    throw new Error("AI fallback failed");
  }

  const fallbackData = (await fallbackRes.json()) as { choices?: { message?: { content?: string } }[] };
  const fallbackRaw = fallbackData.choices?.[0]?.message?.content ?? "";
  const fallbackParsed = tryParse(fallbackRaw);
  if (fallbackParsed !== null) return fallbackParsed;

  throw new Error("Invalid JSON from AI");
}
