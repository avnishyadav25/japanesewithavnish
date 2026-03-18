import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { getPromptContent } from "@/lib/ai/load-prompts";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";

const CORRECTION_SYSTEM_PROMPT_FALLBACK = `You are Nihongo Navi, an expert Japanese tutor. The user will send you a short Japanese sentence (or phrase) that may contain errors.

Your task:
1. If the sentence is correct, say so briefly and optionally suggest a more natural alternative.
2. If there are errors (grammar, particles, word choice, politeness, spelling), provide the corrected sentence and a clear, concise explanation of what was wrong and why the correction is right. Focus on one or two main points.
3. Reply in this exact JSON format only, no other text:
{"corrected":"corrected Japanese sentence","explanation":"1-3 sentences in English explaining the correction","isCorrect":true or false}

Keep the explanation brief and educational.`;

export async function POST(req: Request) {
  try {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) return NextResponse.json({ error: "Correction not configured" }, { status: 503 });

    const body = await req.json();
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return NextResponse.json({ error: "Text required" }, { status: 400 });

    const systemPrompt = (await getPromptContent("correct_sentence")) ?? CORRECTION_SYSTEM_PROMPT_FALLBACK;

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
          { role: "user", content: text },
        ],
        temperature: 0.3,
        max_tokens: 512,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Correct-sentence:", err);
      return NextResponse.json({ error: "Correction failed" }, { status: 502 });
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = (data.choices?.[0]?.message?.content ?? "").trim();

    let corrected = "";
    let explanation = "";
    let isCorrect = false;
    try {
      const parsed = JSON.parse(raw) as { corrected?: string; explanation?: string; isCorrect?: boolean };
      corrected = typeof parsed.corrected === "string" ? parsed.corrected : text;
      explanation = typeof parsed.explanation === "string" ? parsed.explanation : "";
      isCorrect = Boolean(parsed.isCorrect);
    } catch {
      corrected = raw.split('"corrected":')[1]?.split('"')[1] ?? text;
      explanation = raw;
    }

    const session = await getSession();
    if (session?.email && sql) {
      try {
        await sql`
          INSERT INTO user_mistakes (user_email, original_text, corrected_text, explanation, source)
          VALUES (${session.email}, ${text}, ${corrected}, ${explanation}, 'correct_sentence')
        `;
      } catch (e) {
        console.warn("user_mistakes insert (table may not exist):", e);
      }
    }

    return NextResponse.json({
      corrected: corrected || text,
      explanation: explanation || "No explanation provided.",
      isCorrect,
    });
  } catch (e) {
    console.error("Correct-sentence:", e);
    return NextResponse.json({ error: "Failed to correct" }, { status: 500 });
  }
}
