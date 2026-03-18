import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getPromptContent } from "@/lib/ai/load-prompts";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";

const NIHONGO_NAVI_SYSTEM_PROMPT_FALLBACK = `You are Nihongo Navi, the AI Japanese tutor for Japanese with Avnish (japanesewithavnish.com). You are a patient, clear sensei focused on JLPT N5–N4 (and beyond when relevant).

Your role:
- Explain grammar, vocabulary, and kanji using the learning content and context below. Use the lookup tools when the user asks about a specific term or pattern.
- Give practice sentences and correct user sentences with clear explanations.
- Encourage and support the learner. Be concise but thorough.
- When you need to look up a word, grammar point, or kanji from the curriculum, use the appropriate tool (lookup_vocab, lookup_grammar, lookup_kanji) so your answer is accurate.
- You can suggest scheduling a review (schedule_review) or generating a short quiz (generate_quiz) when it fits the conversation.

Use the context below (blogs, products, learning content, support) to give accurate answers. Suggest links when relevant (e.g. /blog/grammar/slug for learning content, /blog/slug for blog posts).`;

type ToolCall = { id: string; name: string; arguments: string };
type Message = { role: string; content?: string; tool_calls?: ToolCall[] };

export async function POST(req: Request) {
  try {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) return NextResponse.json({ error: "Tutor not configured" }, { status: 503 });

    const body = await req.json();
    const messages: Message[] = Array.isArray(body.messages) ? body.messages : [];
    const userMessage =
      messages.length > 0 && typeof messages[messages.length - 1]?.content === "string"
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
        ` as { value: { content?: string } | null }[];
        const val = rows[0]?.value;
        if (val && typeof val.content === "string") contextBlock = val.content;
      } catch {
        // ignore
      }
    }

    const tutorSystemPrompt =
      (await getPromptContent("tutor_system")) ?? NIHONGO_NAVI_SYSTEM_PROMPT_FALLBACK;
    const systemContent = contextBlock
      ? `${tutorSystemPrompt}\n\n## Context (use this and tools to answer)\n\n${contextBlock}`
      : tutorSystemPrompt;

    const apiMessages: { role: string; content: string }[] = [
      { role: "system", content: systemContent },
      ...(messages.length > 1
        ? messages.slice(0, -1).map((m: Message) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: typeof m.content === "string" ? m.content : "",
          }))
        : []),
      { role: "user", content: userMessage },
    ];

    const userEmail =
      typeof body.user_email === "string" ? body.user_email.trim() || undefined : undefined;
    const userMessageCount = messages.filter((m) => m.role === "user").length;
    const isGuest = !userEmail;
    const GUEST_MESSAGE_LIMIT = 5;
    if (isGuest && userMessageCount >= GUEST_MESSAGE_LIMIT) {
      return NextResponse.json({
        reply: "You've used 5 free messages. Create a free account to continue chatting with Nihongo Navi, save your progress, and access rewards. Sign up or log in to keep learning!",
        role: "assistant",
        prompt_register: true,
      });
    }

    const normalizedQuestion = userMessage.trim().toLowerCase();

    if (sql && normalizedQuestion) {
      try {
        const existing = await sql`
          SELECT id, answer, ask_count
          FROM tutor_logs
          WHERE normalized_question = ${normalizedQuestion}
          ORDER BY last_asked_at DESC
          LIMIT 1
        ` as { id: string; answer: string; ask_count: number }[];

        if (existing[0]) {
          const row = existing[0];
          const newCount = row.ask_count + 1;
          await sql`
            UPDATE tutor_logs
            SET ask_count = ${newCount}, last_asked_at = NOW()
            WHERE id = ${row.id}
          `;
          return NextResponse.json({
            reply: row.answer,
            role: "assistant",
            from_cache: true,
            ask_count: newCount,
          });
        }
      } catch (e) {
        console.warn("tutor cache lookup failed:", e);
      }
    }

    const res = await fetch(DEEPSEEK_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: apiMessages,
        temperature: 0.5,
        max_tokens: 1024,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("DeepSeek tutor:", err);
      return NextResponse.json({ error: "Tutor request failed" }, { status: 502 });
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const choice = data.choices?.[0]?.message;
    if (!choice || typeof choice.content !== "string") {
      return NextResponse.json({ error: "No reply from tutor" }, { status: 502 });
    }

    const reply = choice.content.trim();
    if (sql && normalizedQuestion && reply) {
      try {
        await sql`
          INSERT INTO tutor_logs (user_email, question, normalized_question, answer, ask_count, last_asked_at)
          VALUES (${userEmail ?? null}, ${userMessage.trim()}, ${normalizedQuestion}, ${reply}, 1, NOW())
        `;
      } catch (e) {
        console.warn("tutor cache insert failed:", e);
      }
    }

    return NextResponse.json({ reply, role: "assistant", from_cache: false, ask_count: 1 });
  } catch (e) {
    console.error("Tutor:", e);
    return NextResponse.json({ error: "Failed to get reply" }, { status: 500 });
  }
}
