import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPrompt, type ContentType } from "@/lib/ai/prompts";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "DeepSeek not configured" }, { status: 503 });
    }

    const body = await req.json();
    const contentType = body.contentType as ContentType;
    const validTypes: ContentType[] = [
      "blog",
      "newsletter",
      "grammar",
      "vocabulary",
      "kanji",
      "reading",
      "writing",
    ];
    if (!contentType || !validTypes.includes(contentType)) {
      return NextResponse.json({ error: "Invalid contentType" }, { status: 400 });
    }

    const prompt = body.prompt as string | undefined;
    const context = (body.context as Record<string, string>) || {};
    const systemPrompt = getPrompt(contentType, context);
    const userPrompt = prompt || "Generate the content as described.";
    const isBlog = contentType === "blog";

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
            content: isBlog
              ? "Generate the blog post. Return ONLY a valid JSON object with keys: content, title, slug, tags, jlpt_level, seo_title, seo_description, image_prompt, section_image_prompts. No markdown code blocks, no extra text."
              : userPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: isBlog ? 8000 : 4000,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("DeepSeek API:", err);
      return NextResponse.json({ error: "AI generation failed" }, { status: 502 });
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? "";

    if (isBlog) {
      try {
        const extracted = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        const parsed = JSON.parse(extracted) as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        for (const k of ["content", "title", "slug", "tags", "jlpt_level", "seo_title", "seo_description", "image_prompt"]) {
          const v = parsed[k];
          if (typeof v === "string") out[k] = v;
        }
        const sectionImagePrompts = parsed.section_image_prompts;
        if (Array.isArray(sectionImagePrompts) && sectionImagePrompts.length > 0) {
          out.section_image_prompts = sectionImagePrompts.filter(
            (p: unknown) =>
              p &&
              typeof p === "object" &&
              "placeholder" in p &&
              "section" in p &&
              "prompt" in p
          );
        }
        if (out.content) return NextResponse.json(out);
      } catch {
        // Fallback: return content only
      }
    }

    return NextResponse.json({ content: raw });
  } catch (e) {
    console.error("AI generate:", e);
    return NextResponse.json({ error: "Failed to generate" }, { status: 500 });
  }
}
