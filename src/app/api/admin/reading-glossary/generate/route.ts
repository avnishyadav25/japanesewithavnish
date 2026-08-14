import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { getPromptContent } from "@/lib/ai/load-prompts";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";
const GEMINI_TEXT_MODEL = "gemini-2.0-flash";

const FALLBACK_SYSTEM = `You are an expert Japanese teacher creating a reading glossary.
Return ONLY valid JSON array (no markdown, no extra text):
[
  {"segment_text":"...", "definition_text":"..."}
]
Rules:
- segment_text MUST appear verbatim in the provided reading content.
- Prefer words/phrases 1-10 characters (avoid full sentences).
- definition_text should be short English definition/explanation.
`;

function stripFences(raw: string) {
  return (raw || "").replace(/^```\w*\n?|\n?```$/g, "").trim();
}

function toStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: Request) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

    const body = await req.json().catch(() => ({}));
    const slug = typeof body.slug === "string" ? body.slug.trim() : "";
    const postId = typeof body.postId === "string" ? body.postId.trim() : "";
    const levelCode = typeof body.levelCode === "string" ? body.levelCode.trim() : "N5";
    const count = typeof body.count === "number" ? Math.min(60, Math.max(1, body.count)) : 15;
    const regenerate = Boolean(body.regenerate);
    const contentLLM = ((body.content_llm as string) || process.env.CONTENT_LLM || "deepseek").toLowerCase();
    const model = contentLLM === "gemini" ? "gemini" : "deepseek";

    if (!slug && !postId) return NextResponse.json({ error: "slug or postId required" }, { status: 400 });

    const postRows = slug
      ? await sql`SELECT id, content FROM posts WHERE slug = ${slug} LIMIT 1`
      : await sql`SELECT id, content FROM posts WHERE id = ${postId} LIMIT 1`;
    const post = (postRows as { id: string; content: string | null }[])[0];
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    const content = (post.content ?? "").trim();
    if (!content) return NextResponse.json({ error: "Post has no content" }, { status: 400 });

    if (regenerate) {
      await sql`DELETE FROM reading_glossary WHERE post_id = ${post.id}`;
    }

    const systemPrompt = (await getPromptContent("curriculum_reading_glossary")) ?? FALLBACK_SYSTEM;
    const userMessage =
      `Level: ${levelCode}. Generate exactly ${count} glossary items for this reading. ` +
      `segment_text MUST be a substring of the content. Return ONLY JSON array.\n\nCONTENT:\n` +
      content.slice(0, 9000);

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
            generationConfig: { temperature: 0.4, maxOutputTokens: 3500 },
          }),
        }
      );
      if (!res.ok) {
        console.error("Gemini reading glossary:", await res.text());
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
          max_tokens: 3500,
        }),
      });
      if (!res.ok) {
        console.error("DeepSeek reading glossary:", await res.text());
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

    const usedRanges: Array<{ start: number; end: number }> = [];
    const overlaps = (a: { start: number; end: number }) =>
      usedRanges.some((b) => Math.max(a.start, b.start) < Math.min(a.end, b.end));

    let inserted = 0;
    let sort = 0;
    for (const it of arr.slice(0, count)) {
      const obj = it && typeof it === "object" ? (it as Record<string, unknown>) : null;
      const seg = toStr(obj?.segment_text ?? obj?.segmentText);
      const def = toStr(obj?.definition_text ?? obj?.definitionText);
      if (!seg || !def) continue;

      // Find first non-overlapping occurrence.
      let idx = content.indexOf(seg);
      while (idx !== -1) {
        const range = { start: idx, end: idx + seg.length };
        if (!overlaps(range)) {
          usedRanges.push(range);
          await sql`
            INSERT INTO reading_glossary (post_id, segment_text, segment_start, segment_end, definition_text, sort_order)
            VALUES (${post.id}, ${seg}, ${range.start}, ${range.end}, ${def}, ${sort})
          `;
          inserted += 1;
          sort += 10;
          break;
        }
        idx = content.indexOf(seg, idx + 1);
      }
    }

    return NextResponse.json({ inserted });
  } catch (e) {
    console.error("Reading glossary generate:", e);
    return NextResponse.json({ error: "Failed to generate glossary" }, { status: 500 });
  }
}

