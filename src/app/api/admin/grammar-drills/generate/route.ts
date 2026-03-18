import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { getPromptContent } from "@/lib/ai/load-prompts";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";
const GEMINI_TEXT_MODEL = "gemini-2.0-flash";

const FALLBACK_SYSTEM = `You are an expert Japanese teacher creating short grammar drill items.
Rules:
- Output ONLY valid JSON array, no markdown, no extra text.
- Each item must be: {"sentence_ja":"... __ ...", "correct_answers":["..."], "distractors":["..."], "hint":"..."}.
- sentence_ja must contain exactly one "__" placeholder (two underscores).
- correct_answers must be an array of 1-3 strings that are acceptable for the blank.
- distractors must be an array of 3-6 plausible wrong options (strings) and MUST NOT include any correct answer.
- Keep items JLPT-appropriate and aligned to the lesson topic.
`;

function stripFences(raw: string) {
  return (raw || "").replace(/^```\w*\n?|\n?```$/g, "").trim();
}

function normalizeBlank(sentence: string): string {
  const s = (sentence || "").trim();
  if (!s) return s;
  // normalize common blank notations to "__"
  return s
    .replace(/_{3,}/g, "__")
    .replace(/\[\s*\]/g, "__")
    .replace(/\(\s*\)/g, "__")
    .replace(/\s+__\s+/g, " __ ")
    .trim();
}

function uniqStrings(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  for (const x of arr) {
    const s = typeof x === "string" ? x.trim() : "";
    if (!s) continue;
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

    const body = await req.json().catch(() => ({}));
    const lessonId = typeof body.lessonId === "string" ? body.lessonId.trim() : "";
    const grammarId = typeof body.grammarId === "string" ? body.grammarId.trim() : "";
    const count = typeof body.count === "number" ? Math.min(50, Math.max(1, body.count)) : 10;
    const regenerate = Boolean(body.regenerate);
    const levelCode = typeof body.levelCode === "string" ? body.levelCode.trim() : "N5";
    const contentLLM = ((body.content_llm as string) || process.env.CONTENT_LLM || "deepseek").toLowerCase();
    const model = contentLLM === "gemini" ? "gemini" : "deepseek";

    if (!lessonId && !grammarId) {
      return NextResponse.json({ error: "lessonId or grammarId required" }, { status: 400 });
    }

    let lessonTitle = "";
    if (lessonId) {
      const rows = await sql`SELECT title FROM curriculum_lessons WHERE id = ${lessonId} LIMIT 1` as { title: string }[];
      lessonTitle = rows?.[0]?.title ?? "";
    }

    if (regenerate) {
      if (lessonId) await sql`DELETE FROM grammar_drill_items WHERE lesson_id = ${lessonId}`;
      if (grammarId) await sql`DELETE FROM grammar_drill_items WHERE grammar_id = ${grammarId}`;
    }

    const systemPrompt = (await getPromptContent("curriculum_grammar_drills")) ?? FALLBACK_SYSTEM;
    const userMessage = lessonId
      ? `Lesson: ${lessonTitle || lessonId}. Level: ${levelCode}. Generate exactly ${count} drill items. Output ONLY JSON array.`
      : `Grammar ID: ${grammarId}. Level: ${levelCode}. Generate exactly ${count} drill items. Output ONLY JSON array.`;

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
        console.error("Gemini grammar drills:", await res.text());
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
        console.error("DeepSeek grammar drills:", await res.text());
        return NextResponse.json({ error: "AI failed" }, { status: 502 });
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      raw = data.choices?.[0]?.message?.content ?? "";
    }

    const cleaned = stripFences(raw);
    let arr: unknown[] = [];
    try {
      const parsed: unknown = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) throw new Error("Not array");
      arr = parsed;
    } catch {
      return NextResponse.json({ error: "Invalid JSON from AI" }, { status: 502 });
    }

    const items = arr
      .slice(0, count)
      .map((x) => {
        const obj = x && typeof x === "object" ? (x as Record<string, unknown>) : null;
        const sentence = normalizeBlank(typeof obj?.sentence_ja === "string" ? obj.sentence_ja : "");
        const correct = uniqStrings(obj?.correct_answers ?? obj?.correctAnswers ?? []);
        const distractors = uniqStrings(obj?.distractors ?? obj?.options ?? []);
        const hint = typeof obj?.hint === "string" ? obj.hint.trim() : null;
        return { sentence, correct, distractors, hint };
      })
      .filter((x) => x.sentence && x.sentence.includes("__") && x.correct.length && x.distractors.length);

    let inserted = 0;
    let sort = 0;
    for (const it of items) {
      const correctSet = new Set(it.correct);
      const distractors = it.distractors.filter((d) => !correctSet.has(d)).slice(0, 6);
      const correct = it.correct.slice(0, 3);
      if (!distractors.length || !correct.length) continue;

      await sql`
        INSERT INTO grammar_drill_items (lesson_id, grammar_id, sentence_ja, correct_answers, distractors, hint, sort_order)
        VALUES (${lessonId || null}, ${grammarId || null}, ${it.sentence}, ${JSON.stringify(correct)}::jsonb, ${JSON.stringify(distractors)}::jsonb, ${it.hint}, ${sort})
      `;
      inserted += 1;
      sort += 10;
    }

    return NextResponse.json({ inserted });
  } catch (e) {
    console.error("Grammar drills generate:", e);
    return NextResponse.json({ error: "Failed to generate drills" }, { status: 500 });
  }
}

