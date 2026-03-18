import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { getPromptContent } from "@/lib/ai/load-prompts";
import { callDeepSeekWithReasoning } from "@/lib/ai/deepseek-curriculum";

const FALLBACK_SYSTEM = `You are an expert Japanese curriculum designer. Given the current selection in a curriculum (level, module, submodule, and/or lesson), suggest 2-5 short, actionable next steps (e.g. "Add 2 exercises for this lesson", "Consider a submodule for X"). Reply with ONLY a valid JSON object: {"suggestions": ["...", "..."]}. No markdown, no extra text.`;

export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const levelId = typeof body.levelId === "string" ? body.levelId.trim() || null : null;
  const moduleId = typeof body.moduleId === "string" ? body.moduleId.trim() || null : null;
  const submoduleId = typeof body.submoduleId === "string" ? body.submoduleId.trim() || null : null;
  const lessonId = typeof body.lessonId === "string" ? body.lessonId.trim() || null : null;

  if (!levelId && !moduleId && !submoduleId && !lessonId) {
    return NextResponse.json({ error: "At least one of levelId, moduleId, submoduleId, lessonId required" }, { status: 400 });
  }

  let context = "Current selection: ";
  if (sql) {
    try {
      if (levelId) {
        const lv = (await sql`SELECT code, name FROM curriculum_levels WHERE id = ${levelId} LIMIT 1`) as { code: string; name: string }[];
        if (lv[0]) context += `Level ${lv[0].code} (${lv[0].name}). `;
      }
      if (moduleId) {
        const m = (await sql`SELECT code, title FROM curriculum_modules WHERE id = ${moduleId} LIMIT 1`) as { code: string; title: string }[];
        if (m[0]) context += `Module ${m[0].code} (${m[0].title}). `;
      }
      if (submoduleId) {
        const s = (await sql`SELECT code, title FROM curriculum_submodules WHERE id = ${submoduleId} LIMIT 1`) as { code: string; title: string }[];
        if (s[0]) context += `Submodule ${s[0].code} (${s[0].title}). `;
      }
      if (lessonId) {
        const l = (await sql`SELECT code, title FROM curriculum_lessons WHERE id = ${lessonId} LIMIT 1`) as { code: string; title: string }[];
        if (l[0]) context += `Lesson ${l[0].code} (${l[0].title}). `;
      }
    } catch (e) {
      console.error("suggest-next context:", e);
    }
  }
  if (context === "Current selection: ") context = "No specific selection (curriculum overview).";

  const systemPrompt = (await getPromptContent("curriculum_suggest_next")) ?? FALLBACK_SYSTEM;
  const userMessage = `${context} Suggest next steps. Return ONLY JSON: {"suggestions": ["...", "..."]}.`;

  try {
    const result = await callDeepSeekWithReasoning({
      systemPrompt,
      userMessage,
      maxTokens: 400,
      parse: (obj) => {
        const o = obj as { suggestions?: unknown };
        const list = Array.isArray(o.suggestions) ? o.suggestions.filter((x): x is string => typeof x === "string") : [];
        return { suggestions: list };
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("suggest-next:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "AI failed" },
      { status: 502 }
    );
  }
}
