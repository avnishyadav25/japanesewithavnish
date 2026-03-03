import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getAdminSession } from "@/lib/auth/admin";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";

const SYSTEM_PROMPT = `You are "japani-bhai", the friendly assistant for Japanese with Avnish (japanesewithavnish.com). You help visitors with:
- Recommending the right JLPT bundles and courses (N5–N1, Mega Bundle)
- Sharing relevant blog posts and learning resources
- Answering questions about the site, JLPT, and learning path
- If someone didn't receive their order email: ask for their order ID and email, then tell them they can request a resend at the "Request resend" page (order resend form) or contact support.

Use the context below (blogs, products, support info) to give accurate, helpful answers. Be concise and friendly. Suggest specific links when relevant (e.g. /blog/slug, /product/slug).`;

export async function POST(req: Request) {
  try {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) return NextResponse.json({ error: "Chat not configured" }, { status: 503 });

    const body = await req.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const userMessage = messages.length > 0 && typeof messages[messages.length - 1]?.content === "string"
      ? messages[messages.length - 1].content
      : typeof body.message === "string"
        ? body.message
        : "";
    if (!userMessage.trim()) return NextResponse.json({ error: "Message required" }, { status: 400 });

    let contextBlock = "";
    if (sql) {
      try {
        const rows = await sql`
          SELECT value FROM site_settings WHERE key = 'chatbot_context' LIMIT 1
        ` as { value: { content?: string; updatedAt?: string } | null }[];
        const val = rows[0]?.value;
        if (val && typeof val.content === "string") contextBlock = val.content;
      } catch {
        // ignore
      }
    }

    const systemContent = contextBlock
      ? `${SYSTEM_PROMPT}\n\n## Context (use this to answer)\n\n${contextBlock}`
      : SYSTEM_PROMPT;

    const res = await fetch(DEEPSEEK_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemContent },
          ...(Array.isArray(messages) && messages.length > 1
            ? messages.slice(0, -1).map((m: { role?: string; content?: string }) => ({
                role: m.role === "assistant" ? "assistant" : "user",
                content: typeof m.content === "string" ? m.content : "",
              }))
            : []),
          { role: "user", content: userMessage },
        ],
        temperature: 0.6,
        max_tokens: 1024,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("DeepSeek chat:", err);
      return NextResponse.json({ error: "Chat failed" }, { status: 502 });
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const reply = (data.choices?.[0]?.message?.content ?? "").trim();

    // Log this turn for admin test sessions
    const sessionId = typeof body.session_id === "string" ? body.session_id.trim() : null;
    const admin = await getAdminSession();
    if (sessionId && admin?.email && sql) {
      try {
        await sql`
          INSERT INTO admin_chat_logs (session_id, admin_email, role, content)
          VALUES (${sessionId}::uuid, ${admin.email}, 'user', ${userMessage}),
                 (${sessionId}::uuid, ${admin.email}, 'assistant', ${reply})
        `;
      } catch (logErr) {
        console.error("Admin chat log insert:", logErr);
      }
    }

    return NextResponse.json({ reply, role: "assistant" });
  } catch (e) {
    console.error("Chat:", e);
    return NextResponse.json({ error: "Failed to get reply" }, { status: 500 });
  }
}
