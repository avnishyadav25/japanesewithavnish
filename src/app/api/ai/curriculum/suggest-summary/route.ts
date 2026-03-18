import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { getPromptContent } from "@/lib/ai/load-prompts";
import { callDeepSeekWithReasoning } from "@/lib/ai/deepseek-curriculum";

const FALLBACK_SYSTEM = `You are an expert Japanese curriculum writer. Given context about a level, module, submodule, lesson, or exercise, suggest a short summary (1-2 sentences for cards/lists) and optionally a longer description. Reply with ONLY a valid JSON object: {"summary":"...", "description":"..."}. No markdown, no extra text.`;

export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const entityType = (body.entityType as string) || "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const levelCode = typeof body.levelCode === "string" ? body.levelCode.trim() : "";
  const levelName = typeof body.levelName === "string" ? body.levelName.trim() : "";
  const moduleTitle = typeof body.moduleTitle === "string" ? body.moduleTitle.trim() : "";
  const goal = typeof body.goal === "string" ? body.goal.trim() : "";

  const displayName = name || title || code || "item";
  let context = `${entityType}: ${displayName}.`;
  if (code) context += ` Code: ${code}.`;
  if (levelCode || levelName) context += ` Level: ${levelCode || levelName}.`;
  if (moduleTitle) context += ` Module: ${moduleTitle}.`;
  if (goal) context += ` Goal: ${goal}.`;

  const systemPrompt = (await getPromptContent("curriculum_suggest_summary")) ?? FALLBACK_SYSTEM;
  const userMessage = `Context: ${context} Generate summary and description. Return ONLY JSON: {"summary":"...", "description":"..."}.`;

  try {
    const result = await callDeepSeekWithReasoning({
      systemPrompt,
      userMessage,
      maxTokens: 500,
      parse: (obj) => {
        const o = obj as { summary?: string; description?: string };
        return {
          summary: typeof o.summary === "string" ? o.summary : "",
          description: typeof o.description === "string" ? o.description : "",
        };
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("suggest-summary:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI failed" },
      { status: 502 }
    );
  }
}
