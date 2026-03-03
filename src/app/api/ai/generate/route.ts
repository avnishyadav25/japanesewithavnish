import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { getPrompt, type ContentType } from "@/lib/ai/prompts";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";

export async function POST(req: Request) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
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
      "listening",
      "writing",
      "product",
    ];
    if (!contentType || !validTypes.includes(contentType)) {
      return NextResponse.json({ error: "Invalid contentType" }, { status: 400 });
    }

    const prompt = body.prompt as string | undefined;
    const context = (body.context as Record<string, string>) || {};
    const systemPrompt = getPrompt(contentType, context);
    const userPrompt = prompt || "Generate the content as described.";
    const isBlog = contentType === "blog";
    const isProduct = contentType === "product";
    const isJsonResponse = isBlog || isProduct;

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
              : isProduct
                ? "Generate the product copy. Return ONLY a valid JSON object with keys: description, who_its_for, outcome, whats_included, faq, no_refunds_note, image_prompt. No markdown code blocks, no extra text."
                : userPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: isBlog ? 8000 : isProduct ? 3000 : 4000,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("DeepSeek API:", err);
      return NextResponse.json({ error: "AI generation failed" }, { status: 502 });
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? "";

    if (isJsonResponse) {
      try {
        const extracted = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        const parsed = JSON.parse(extracted) as Record<string, unknown>;
        const out: Record<string, unknown> = {};

        if (isBlog) {
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
        }

        if (isProduct) {
          for (const k of ["description", "who_its_for", "outcome", "no_refunds_note", "image_prompt"]) {
            const v = parsed[k];
            if (typeof v === "string") out[k] = v;
          }
          if (Array.isArray(parsed.whats_included)) out.whats_included = parsed.whats_included;
          if (Array.isArray(parsed.faq)) out.faq = parsed.faq;
          if (out.description || out.who_its_for) return NextResponse.json(out);
        }
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
