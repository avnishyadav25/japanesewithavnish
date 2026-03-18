import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { getPromptContent } from "@/lib/ai/load-prompts";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";
const GEMINI_TEXT_MODEL = "gemini-2.0-flash";

const FALLBACK_SYSTEM = `You are an expert Japanese curriculum writer. Given a lesson title and optional goal, write a short student-facing introduction paragraph (2-4 sentences) that motivates and sets context. Optionally refine the goal into one clear sentence. Reply with ONLY a valid JSON object: {"introduction":"...", "goal":"..."}. No markdown, no extra text.`;

export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const lessonTitle = typeof body.lessonTitle === "string" ? body.lessonTitle.trim() : "";
  const goal = typeof body.goal === "string" ? body.goal.trim() : "";
  const levelCode = typeof body.levelCode === "string" ? body.levelCode.trim() : "N5";
  const contentLLM = ((body.content_llm as string) || process.env.CONTENT_LLM || "deepseek").toLowerCase();
  const model = contentLLM === "gemini" ? "gemini" : "deepseek";

  if (!lessonTitle) return NextResponse.json({ error: "lessonTitle required" }, { status: 400 });

  const systemPrompt = (await getPromptContent("curriculum_lesson_intro")) ?? FALLBACK_SYSTEM;
  const userMessage = `Lesson title: ${lessonTitle}. Level: ${levelCode}.${goal ? ` Goal: ${goal}.` : ""} Generate introduction and goal. Return ONLY JSON: {"introduction":"...", "goal":"..."}.`;

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
          generationConfig: { temperature: 0.5, maxOutputTokens: 600 },
        }),
      }
    );
    if (!res.ok) {
      console.error("Gemini curriculum intro:", await res.text());
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
        max_tokens: 600,
      }),
    });
    if (!res.ok) {
      console.error("DeepSeek curriculum intro:", await res.text());
      return NextResponse.json({ error: "AI failed" }, { status: 502 });
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    raw = data.choices?.[0]?.message?.content ?? "";
  }

  const cleaned = raw.replace(/^```\w*\n?|\n?```$/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as { introduction?: string; goal?: string };
    return NextResponse.json({
      introduction: typeof parsed.introduction === "string" ? parsed.introduction : "",
      goal: typeof parsed.goal === "string" ? parsed.goal : goal,
    });
  } catch {
    return NextResponse.json({ error: "Invalid JSON from AI" }, { status: 502 });
  }
}
