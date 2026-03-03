import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { insertAiLog } from "@/lib/ai-logs";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";

export async function POST(req: Request) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) return NextResponse.json({ error: "DeepSeek not configured" }, { status: 503 });

    const body = await req.json();
    const slug = typeof body.slug === "string" ? body.slug.trim() : "";
    if (!slug || !sql) return NextResponse.json({ error: "slug required" }, { status: 400 });

    const rows = await sql`
      SELECT id, title, content, summary FROM posts WHERE slug = ${slug} LIMIT 1
    ` as { id: string; title: string; content: string | null; summary: string | null }[];
    const post = rows[0];
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    const content = post.content ?? "";
    const textForSummary = content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 15000);
    if (!textForSummary) return NextResponse.json({ error: "Post has no content to summarize" }, { status: 400 });

    const systemPrompt = `You are an expert editor. Write a concise, engaging summary of the given blog post. Use 200-400 words. Write in clear, professional prose. Do not use bullet points unless the content is inherently a list. Output ONLY the summary text, no heading or labels.`;

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
          {
            role: "user",
            content: `Blog title: ${post.title}\n\nContent to summarize:\n\n${textForSummary}`,
          },
        ],
        temperature: 0.5,
        max_tokens: 600,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("DeepSeek blog-summary:", err);
      return NextResponse.json({ error: "AI summary failed" }, { status: 502 });
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const summary = (data.choices?.[0]?.message?.content ?? "").trim();
    if (!summary) return NextResponse.json({ error: "Empty summary from AI" }, { status: 502 });

    await sql`UPDATE posts SET summary = ${summary}, updated_at = ${new Date().toISOString()} WHERE id = ${post.id}`;
    await insertAiLog({
      log_type: "blog_summary",
      content_type: "blog",
      entity_type: "post",
      entity_id: post.id,
      model_used: "deepseek",
      prompt_sent: systemPrompt,
      result_preview: summary.slice(0, 500),
      admin_email: admin?.email,
    });
    return NextResponse.json({ summary });
  } catch (e) {
    console.error("Blog summary:", e);
    return NextResponse.json({ error: "Failed to generate summary" }, { status: 500 });
  }
}
