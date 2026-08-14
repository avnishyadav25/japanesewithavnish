import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { getPromptContent } from "@/lib/ai/load-prompts";
import { parseProseToBlocks } from "@/lib/curriculum/parseProseToBlocks";
import { validateBlockData } from "@/lib/blocks/blockTypes";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";
const GEMINI_TEXT_MODEL = "gemini-2.0-flash";

const BODY_SYSTEM = `You are an expert Japanese curriculum writer. Write the MAIN LESSON BODY (teaching content) in Markdown.

Core rules:
- Output ONLY the Markdown. No JSON, no code fences.
- Always include romaji for kana/characters (never omit romaji).
- Write original Japanese with Avnish teaching content. You may use JLPT reference lists to understand topic coverage, but never copy outside lesson text.
- Use a flow-based lesson structure with these exact sections:
  ## Learning Goal
  ## Concept
  ## Step-by-Step Breakdown
  ## Mini Examples
  ## Common Mistake
  ## Quick Practice
  ## Summary and Next Step
- Use Markdown callouts where helpful:
  > [!TIP] for memory tips
  > [!MISTAKE] for learner traps
  > [!PRACTICE] for practice prompts

Kana / character lessons:
- Teach each kana/character you see in the linked kana list.
- For EACH sound/kana, include:
  Character (Hiragana and/or Katakana), Romaji (primary), Alt romaji (common alternative spelling) IF it exists, sound description in 2-4 simple English words,
  memory tip, writing/stroke-order note, and 1-2 example words.
- If teaching Hiragana, also include the matching Katakana for the same sounds (and vice versa) so learners get both scripts.

Grammar / vocab lessons:
- Explain the pattern and meaning with examples. Include romaji and English for examples.

Length:
- Minimum 700 characters. Enough depth for the whole lesson (for N5 “first 15 sounds”, cover each sound clearly).`;

export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const lessonId = typeof body.lessonId === "string" ? body.lessonId.trim() : "";
  const contentLLM = ((body.content_llm as string) || process.env.CONTENT_LLM || "deepseek").toLowerCase();
  const model = contentLLM === "gemini" ? "gemini" : "deepseek";

  if (!lessonId) return NextResponse.json({ error: "lessonId required" }, { status: 400 });

  const lessonRows = (await sql`
    SELECT l.id, l.title, l.goal, l.introduction, lv.code AS level_code
    FROM curriculum_lessons l
    JOIN curriculum_submodules sm ON sm.id = l.submodule_id
    JOIN curriculum_modules m ON m.id = sm.module_id
    JOIN curriculum_levels lv ON lv.id = m.level_id
    WHERE l.id = ${lessonId} LIMIT 1
  `) as { id: string; title: string; goal: string | null; introduction: string | null; level_code: string }[];
  const lesson = lessonRows[0];
  if (!lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });

  const existingBlocks = (await sql`SELECT COUNT(*) AS count FROM lesson_blocks WHERE lesson_id = ${lessonId}`) as { count: string }[];
  if (Number(existingBlocks[0]?.count ?? 0) > 0) {
    return NextResponse.json(
      { error: "Lesson already has content blocks. Delete existing blocks in the Lesson Content Blocks editor first, then generate again." },
      { status: 409 }
    );
  }

  const levelCode = lesson.level_code || "N5";

  const kanaRows = (await sql`
    SELECT k.character, k.romaji, k.row_label, k.type
    FROM curriculum_lesson_kana lk
    JOIN kana k ON k.id = lk.kana_id
    WHERE lk.lesson_id = ${lessonId}
    ORDER BY lk.sort_order, k.sort_order
  `) as { character: string; romaji: string; row_label: string | null; type: string }[];
  const vocabRows = (await sql`
    SELECT v.word, v.reading, v.meaning
    FROM curriculum_lesson_vocabulary lv
    JOIN vocabulary v ON v.id = lv.vocabulary_id
    WHERE lv.lesson_id = ${lessonId}
    ORDER BY lv.sort_order
    LIMIT 20
  `) as { word: string; reading: string | null; meaning: string | null }[];
  const grammarRows = (await sql`
    SELECT g.pattern, g.structure
    FROM curriculum_lesson_grammar lg
    JOIN grammar g ON g.id = lg.grammar_id
    WHERE lg.lesson_id = ${lessonId}
    ORDER BY lg.sort_order
    LIMIT 10
  `) as { pattern: string | null; structure: string | null }[];

  const kanaContext = kanaRows.length
    ? `Kana for this lesson: ${kanaRows.map((k) => `${k.character} (${k.romaji}) [${k.type}]`).join(", ")}.`
    : "";
  const vocabContext = vocabRows.length
    ? `Vocabulary: ${vocabRows.map((v) => `${v.word} — ${v.meaning ?? ""}`).join("; ")}.`
    : "";
  const grammarContext = grammarRows.length
    ? `Grammar patterns: ${grammarRows.map((g) => g.pattern || g.structure).filter(Boolean).join(", ")}.`
    : "";

  const userMessage = `Lesson title: ${lesson.title}. Level: ${levelCode}.
Goal: ${lesson.goal ?? "—"}
Introduction (for context): ${(lesson.introduction ?? "").slice(0, 400)}
${kanaContext}
${vocabContext}
${grammarContext}

Write the full lesson body in Markdown using the required flow: Learning Goal, Concept, Step-by-Step Breakdown, Mini Examples, Common Mistake, Quick Practice, Summary and Next Step. Teach the topic so a beginner can follow. Output ONLY the Markdown, no code fences or labels.`;

  const systemPrompt = (await getPromptContent("curriculum_lesson_body")) ?? BODY_SYSTEM;

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
          generationConfig: { temperature: 0.4, maxOutputTokens: 4000 },
        }),
      }
    );
    if (!res.ok) {
      console.error("Gemini lesson body:", await res.text());
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
        temperature: 0.4,
        max_tokens: 4000,
      }),
    });
    if (!res.ok) {
      console.error("DeepSeek lesson body:", await res.text());
      return NextResponse.json({ error: "AI failed" }, { status: 502 });
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    raw = data.choices?.[0]?.message?.content ?? "";
  }

  const markdown = raw.replace(/^```\w*\n?|\n?```$/g, "").trim() || "## " + lesson.title + "\n\n_Content generated._";

  const plannedBlocks = parseProseToBlocks(markdown);
  const errors: string[] = [];
  for (const b of plannedBlocks) {
    const errs = validateBlockData(b.block_type, b.block_data);
    if (errs.length > 0) errors.push(`${b.block_type}: ${errs.join(", ")}`);
  }
  if (errors.length > 0) {
    return NextResponse.json({ error: `Generated content failed validation: ${errors.join(" | ")}` }, { status: 502 });
  }

  let sortOrder = 10;
  for (const b of plannedBlocks) {
    await sql`
      INSERT INTO lesson_blocks (lesson_id, block_type, block_data, sort_order, status, review_status, generated_by_model)
      VALUES (${lessonId}, ${b.block_type}, ${JSON.stringify(b.block_data)}::jsonb, ${sortOrder}, 'draft', 'pending', ${model})
    `;
    sortOrder += 10;
  }

  return NextResponse.json({ blockCount: plannedBlocks.length });
}
