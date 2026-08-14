import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";

export async function POST(req: Request) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) return NextResponse.json({ error: "AI not configured" }, { status: 503 });

    const body = await req.json();
    const contentType = (body.contentType as string) || "blog";
    const title = String(body.title ?? "");
    const description = String(body.description ?? "").slice(0, 3000);
    const link = String(body.link ?? "");

    const systemPrompt = `You are a social media copywriter for Japanese with Avnish (JLPT learning site). Generate short, engaging captions and hashtags for the given content. Output valid JSON only, no markdown, with this structure:
{
  "instagram": { "caption": "...", "hashtags": "...#hashtag1 #hashtag2" },
  "twitter": { "caption": "..." },
  "linkedin": { "caption": "..." },
  "pinterest": { "caption": "..." },
  "facebook": { "caption": "..." }
}
Keep Instagram caption under 150 chars for feed; Twitter under 280; LinkedIn/Facebook 1-2 sentences. Hashtags: 5-10 relevant (JLPT, Japanese, learning). Tone: helpful, professional, no spam.`;

    const userPrompt = `Content type: ${contentType}. Title: ${title}. ${description ? `Description/summary: ${description}` : ""} ${link ? `Link: ${link}` : ""}. Generate the JSON.`;

    const res = await fetch(DEEPSEEK_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        temperature: 0.6,
        max_tokens: 800,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("Social copy:", err);
      return NextResponse.json({ error: "Generation failed" }, { status: 502 });
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = (data.choices?.[0]?.message?.content ?? "").trim();
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleaned) as Record<string, { caption?: string; hashtags?: string }>;
    return NextResponse.json(parsed);
  } catch (e) {
    console.error("Social copy:", e);
    return NextResponse.json({ error: "Failed to generate" }, { status: 500 });
  }
}
