import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { getPromptContent } from "@/lib/ai/load-prompts";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";
const GEMINI_TEXT_MODEL = "gemini-2.0-flash";

const FALLBACK_SYSTEM = `You are an expert Japanese teacher creating JLPT-style listening practice.
Return ONLY valid JSON object (no markdown, no extra text):
{
  "scenarios": [
    {
      "title": "...",
      "transcript": "... (Japanese)",
      "questions": [
        {"question_text":"...", "options":["...","...","...","..."], "correct_index":0}
      ]
    }
  ]
}
Rules:
- Keep it JLPT-appropriate (simple for N5).
- transcript should be Japanese only, 2-6 lines max.
- Each scenario must have 2-4 questions.
- options must be an array of 3-4 strings. correct_index must be 0-based and valid.
`;

function stripFences(raw: string) {
  return (raw || "").replace(/^```\w*\n?|\n?```$/g, "").trim();
}

function toStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function toOptions(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 4);
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = (v as Record<string, unknown>).options;
    if (Array.isArray(o)) return o.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 4);
  }
  return [];
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

    const body = await req.json().catch(() => ({}));
    const listeningId = typeof body.listeningId === "string" ? body.listeningId.trim() : "";
    const listeningSlug = typeof body.listeningSlug === "string" ? body.listeningSlug.trim() : "";
    const levelCode = typeof body.levelCode === "string" ? body.levelCode.trim() : "N5";
    const scenarioCount = typeof body.scenarioCount === "number" ? Math.min(20, Math.max(1, body.scenarioCount)) : 3;
    const questionsPerScenario = typeof body.questionsPerScenario === "number" ? Math.min(5, Math.max(1, body.questionsPerScenario)) : 3;
    const regenerate = Boolean(body.regenerate);
    const contentLLM = ((body.content_llm as string) || process.env.CONTENT_LLM || "deepseek").toLowerCase();
    const model = contentLLM === "gemini" ? "gemini" : "deepseek";

    let resolvedListeningId = listeningId;
    let listeningTitle = "";
    if (!resolvedListeningId && listeningSlug) {
      const rows = await sql`
        SELECT li.id, li.title
        FROM listening li
        JOIN posts p ON p.id = li.post_id
        WHERE p.slug = ${listeningSlug}
        LIMIT 1
      ` as { id: string; title: string | null }[];
      resolvedListeningId = rows?.[0]?.id ?? "";
      listeningTitle = rows?.[0]?.title ?? "";
    } else if (resolvedListeningId) {
      const rows = await sql`SELECT title FROM listening WHERE id = ${resolvedListeningId} LIMIT 1` as { title: string | null }[];
      listeningTitle = rows?.[0]?.title ?? "";
    }
    if (!resolvedListeningId) {
      return NextResponse.json({ error: "listeningId or listeningSlug required" }, { status: 400 });
    }

    if (regenerate) {
      const scenarioIds = await sql`
        SELECT id FROM listening_scenarios WHERE listening_id = ${resolvedListeningId}
      ` as { id: string }[];
      const ids = scenarioIds.map((r) => r.id);
      if (ids.length) {
        await sql`DELETE FROM listening_questions WHERE scenario_id = ANY(${ids}::uuid[])`;
      }
      await sql`DELETE FROM listening_scenarios WHERE listening_id = ${resolvedListeningId}`;
    }

    const systemPrompt = (await getPromptContent("curriculum_listening_scenarios")) ?? FALLBACK_SYSTEM;
    const userMessage =
      `Listening: ${listeningTitle || listeningSlug || resolvedListeningId}. Level: ${levelCode}. ` +
      `Generate exactly ${scenarioCount} scenarios, each with exactly ${questionsPerScenario} questions. ` +
      `Return ONLY JSON object with key "scenarios".`;

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
            generationConfig: { temperature: 0.5, maxOutputTokens: 3500 },
          }),
        }
      );
      if (!res.ok) {
        console.error("Gemini listening generate:", await res.text());
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
          max_tokens: 3500,
        }),
      });
      if (!res.ok) {
        console.error("DeepSeek listening generate:", await res.text());
        return NextResponse.json({ error: "AI failed" }, { status: 502 });
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      raw = data.choices?.[0]?.message?.content ?? "";
    }

    const cleaned = stripFences(raw);
    let scenarios: unknown[] = [];
    try {
      const parsed: unknown = JSON.parse(cleaned);
      const arr = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>).scenarios : undefined;
      if (!Array.isArray(arr)) throw new Error("No scenarios array");
      scenarios = arr;
    } catch {
      return NextResponse.json({ error: "Invalid JSON from AI" }, { status: 502 });
    }

    const audioUrl = "/api/audio/silence";
    let insertedScenarios = 0;
    let insertedQuestions = 0;
    let sort = 0;

    for (const sc of scenarios.slice(0, scenarioCount)) {
      const scObj = sc && typeof sc === "object" ? (sc as Record<string, unknown>) : null;
      const title = toStr(scObj?.title) || `Listening scenario ${insertedScenarios + 1}`;
      const transcript = toStr(scObj?.transcript) || null;
      const questions = Array.isArray(scObj?.questions) ? (scObj?.questions as unknown[]) : [];

      const scenarioRows = await sql`
        INSERT INTO listening_scenarios (listening_id, title, audio_url, transcript, sort_order)
        VALUES (${resolvedListeningId}, ${title}, ${audioUrl}, ${transcript}, ${sort})
        RETURNING id
      ` as { id: string }[];
      const scenarioId = scenarioRows[0]!.id;
      insertedScenarios += 1;

      let qSort = 0;
      for (const q of questions.slice(0, questionsPerScenario)) {
        const qObj = q && typeof q === "object" ? (q as Record<string, unknown>) : null;
        const questionText = toStr(qObj?.question_text ?? qObj?.questionText);
        const options = toOptions(qObj?.options);
        const correctIndexRaw =
          typeof qObj?.correct_index === "number"
            ? qObj.correct_index
            : typeof qObj?.correctIndex === "number"
              ? qObj.correctIndex
              : 0;
        const correctIndex = Number.isFinite(correctIndexRaw) ? Math.max(0, Math.min(options.length - 1, Math.trunc(correctIndexRaw))) : 0;
        if (!questionText || options.length < 3) continue;

        await sql`
          INSERT INTO listening_questions (scenario_id, question_text, options, correct_index, sort_order)
          VALUES (${scenarioId}, ${questionText}, ${JSON.stringify(options)}::jsonb, ${correctIndex}, ${qSort})
        `;
        insertedQuestions += 1;
        qSort += 10;
      }

      sort += 10;
    }

    return NextResponse.json({ insertedScenarios, insertedQuestions, audioUrl });
  } catch (e) {
    console.error("Listening generate:", e);
    return NextResponse.json({ error: "Failed to generate" }, { status: 500 });
  }
}

