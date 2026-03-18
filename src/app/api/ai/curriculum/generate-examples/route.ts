import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { getPromptContent } from "@/lib/ai/load-prompts";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";
const GEMINI_TEXT_MODEL = "gemini-2.0-flash";

const FALLBACK_SYSTEM = `You are an expert Japanese curriculum writer. Generate example sentences for a lesson or vocabulary/grammar point. Each example: sentence_ja (Japanese), sentence_romaji (optional), sentence_en (English). Reply with ONLY a valid JSON array: [{"sentence_ja":"...", "sentence_romaji":"...", "sentence_en":"..."}]. No markdown, no extra text.`;

export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const lessonTitle = typeof body.lessonTitle === "string" ? body.lessonTitle.trim() : "";
  const levelCode = typeof body.levelCode === "string" ? body.levelCode.trim() : "N5";
  const count = typeof body.count === "number" ? Math.min(15, Math.max(1, body.count)) : 5;
  const context = typeof body.context === "string" ? body.context.trim() : "";
  const contentLLM = ((body.content_llm as string) || process.env.CONTENT_LLM || "deepseek").toLowerCase();
  const model = contentLLM === "gemini" ? "gemini" : "deepseek";

  const systemPrompt = (await getPromptContent("curriculum_examples")) ?? FALLBACK_SYSTEM;
  const userMessage = lessonTitle
    ? `Lesson: ${lessonTitle}. Level: ${levelCode}.${context ? ` Context: ${context}.` : ""} Generate ${count} example sentences. Return ONLY JSON array: [{"sentence_ja":"...", "sentence_romaji":"...", "sentence_en":"..."}].`
    : context
      ? `Context: ${context}. Level: ${levelCode}. Generate ${count} example sentences. Return ONLY JSON array.`
      : null;
  if (!userMessage) return NextResponse.json({ error: "lessonTitle or context required" }, { status: 400 });

  let raw: string;
  if (model === "gemini") {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) return NextResponse.json({ error: "Gemini not configured" }, { status: 503 });
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userMessage }] }],
          generationConfig: { temperature: 0.5, maxOutputTokens: 3000 },
        }),
      }
    );
    if (!res.ok) {
      console.error("Gemini curriculum examples:", await res.text());
      return NextResponse.json({ error: "AI failed" }, { status: 502 });
    }
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  } else {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) return NextResponse.json({ error: "DeepSeek not configured" }, { status: 503 });
    const res = await fetch(DEEPSEEK_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.5,
        max_tokens: 3000,
      }),
    });
    if (!res.ok) {
      console.error("DeepSeek curriculum examples:", await res.text());
      return NextResponse.json({ error: "AI failed" }, { status: 502 });
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    raw = data.choices?.[0]?.message?.content ?? "";
  }

  const cleaned = raw.replace(/^```\w*\n?|\n?```$/g, "").trim();
  try {
    const arr = JSON.parse(cleaned);
    if (!Array.isArray(arr)) throw new Error("Not an array");
    const items = arr.slice(0, count).map((x: { sentence_ja?: string; sentence_romaji?: string; sentence_en?: string }) => ({
      sentence_ja: typeof x?.sentence_ja === "string" ? x.sentence_ja : "",
      sentence_romaji: typeof x?.sentence_romaji === "string" ? x.sentence_romaji : "",
      sentence_en: typeof x?.sentence_en === "string" ? x.sentence_en : "",
    }));
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: "Invalid JSON from AI" }, { status: 502 });
  }
}
