import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { getPromptContent } from "@/lib/ai/load-prompts";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";
const GEMINI_TEXT_MODEL = "gemini-2.0-flash";

function slugify(input: string): string {
  return (input || "")
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

const BODY_SYSTEM = `You are an expert Japanese curriculum writer. Write the MAIN LESSON BODY (teaching content) in Markdown.

Core rules:
- Output ONLY the Markdown. No JSON, no code fences.
- Always include romaji for kana/characters (never omit romaji).

Kana / character lessons:
- Teach each kana/character you see in the linked kana list.
- For EACH sound/kana, include:
  Character (Hiragana and/or Katakana), Romaji (primary), Alt romaji (common alternative spelling) IF it exists, sound description in 2-4 simple English words,
  memory tip, writing/stroke-order note, and 1-2 example words.
- If teaching Hiragana, also include the matching Katakana for the same sounds (and vice versa) so learners get both scripts.

Grammar / vocab lessons:
- Explain the pattern and meaning with examples. Include romaji and English for examples.

Length:
- Enough depth for the whole lesson (for N5 “first 15 sounds”, cover each sound clearly).`;

export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const lessonId = typeof body.lessonId === "string" ? body.lessonId.trim() : "";
  const regenerate = body.regenerate === true;
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

  const levelCode = lesson.level_code || "N5";
  const baseSlug = `${levelCode.toLowerCase()}-${slugify(lesson.title)}`.replace(/-+/g, "-").slice(0, 70);
  let mainSlug = `${baseSlug}-main`;

  let mainPostId: string | null = null;
  let mainLinkId: string | null = null;
  const contentRows = (await sql`
    SELECT c.id, c.content_slug, c.post_id
    FROM curriculum_lesson_content c
    WHERE c.lesson_id = ${lessonId} AND c.content_role = 'main'
    ORDER BY c.sort_order LIMIT 1
  `) as { id: string; content_slug: string; post_id: string | null }[];
  const mainLink = contentRows[0];
  if (mainLink?.post_id) {
    mainPostId = mainLink.post_id;
  } else if (mainLink) {
    mainLinkId = mainLink.id;
    const postRows = (await sql`SELECT id FROM posts WHERE slug = ${mainLink.content_slug} AND content_type = 'study_guide' LIMIT 1`) as { id: string }[];
    if (postRows[0]) mainPostId = postRows[0].id;
  }
  if (mainLink && !mainPostId) mainSlug = mainLink.content_slug;
  const resolvedMainSlug = mainLink?.content_slug ?? mainSlug;

  // If we already have main content and user only clicked "Generate",
  // avoid overwriting; this matches the intended semantics vs "Regenerate".
  if (mainPostId && !regenerate) {
    const existing = (await sql`
      SELECT content
      FROM posts
      WHERE id = ${mainPostId}
      LIMIT 1
    `) as { content: string | null }[];

    return NextResponse.json({
      content: existing?.[0]?.content ?? "",
      content_slug: resolvedMainSlug,
      post_id: mainPostId,
    });
  }

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
    ? `Kana for this lesson: ${kanaRows
        .map((k) => `${k.character} (${k.romaji}) [${k.type}]`)
        .join(", ")}.`
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

Write the full lesson body in Markdown. Teach the topic so a beginner can follow. Output ONLY the Markdown, no code fences or labels.${regenerate ? " Replace any existing content with a fresh, complete lesson body." : ""}`;

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

  const content = raw.replace(/^```\w*\n?|\n?```$/g, "").trim() || "## " + lesson.title + "\n\n_Content generated._";

  if (!mainPostId) {
    const insertPost = (await sql`
      INSERT INTO posts (content_type, slug, title, content, summary, jlpt_level, tags, status, published_at, sort_order, meta)
      VALUES (
        'study_guide',
        ${mainSlug},
        ${lesson.title + " (Main)"},
        ${content},
        ${`Main lesson content: ${lesson.title}`},
        ${[levelCode]},
        ${[levelCode, "lesson", "curriculum"]},
        'published',
        ${new Date().toISOString()},
        0,
        '{}'::jsonb
      )
      ON CONFLICT (slug) DO UPDATE SET content = EXCLUDED.content, title = EXCLUDED.title, updated_at = NOW()
      RETURNING id
    `) as { id: string }[];
    mainPostId = insertPost[0]?.id ?? null;
    if (mainPostId && mainLinkId) {
      await sql`UPDATE curriculum_lesson_content SET post_id = ${mainPostId}, updated_at = NOW() WHERE id = ${mainLinkId}`;
    } else if (mainPostId) {
      await sql`
        INSERT INTO curriculum_lesson_content (lesson_id, content_slug, post_id, content_role, sort_order)
        VALUES (${lessonId}, ${mainSlug}, ${mainPostId}, 'main', 0)
      `;
    }
  } else {
    await sql`UPDATE posts SET content = ${content}, updated_at = NOW() WHERE id = ${mainPostId}`;
  }

  return NextResponse.json({
    content,
    content_slug: mainSlug,
    post_id: mainPostId,
  });
}
