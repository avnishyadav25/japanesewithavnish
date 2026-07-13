import { getPromptContent } from "@/lib/ai/load-prompts";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";

/** Shared DeepSeek call for drafting admin replies to Contact/Comments/Feedback submissions. */
export async function draftAdminReply(params: {
  promptKey: string;
  fallbackSystemPrompt: string;
  userContext: string;
}): Promise<{ draft: string; systemPrompt: string } | { error: string }> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return { error: "DeepSeek not configured" };

  const systemPrompt = (await getPromptContent(params.promptKey)) ?? params.fallbackSystemPrompt;

  const res = await fetch(DEEPSEEK_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: params.userContext },
      ],
      temperature: 0.6,
      max_tokens: 600,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("DeepSeek admin-reply draft:", err);
    return { error: "AI draft failed" };
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const draft = (data.choices?.[0]?.message?.content ?? "").trim();
  if (!draft) return { error: "Empty draft from AI" };

  return { draft, systemPrompt };
}
