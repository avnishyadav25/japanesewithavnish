import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { getPrompt, type ContentType } from "@/lib/ai/prompts";
import { insertAiLog } from "@/lib/ai-logs";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";
const GEMINI_TEXT_MODEL = "gemini-2.0-flash";

export async function POST(req: Request) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const context = (body.context as Record<string, string>) || {};
    const customPrompt = typeof body.customPrompt === "string" ? body.customPrompt.trim() : "";
    const systemPrompt = customPrompt || getPrompt(contentType, context);
    const isBlog = contentType === "blog";
    const isProduct = contentType === "product";
    const isJsonResponse = isBlog || isProduct;
    const userMessage = isBlog
      ? "Generate the blog post. Return ONLY a valid JSON object with keys: content, title, slug, tags, jlpt_level, seo_title, seo_description, image_prompt, section_image_prompts. No markdown code blocks, no extra text."
      : isProduct
        ? "Generate the product copy. Return ONLY a valid JSON object with keys: description, who_its_for, outcome, whats_included, faq, no_refunds_note, image_prompt. No markdown code blocks, no extra text."
        : "Generate the content as described.";

    const contentLLM = (process.env.CONTENT_LLM || "deepseek").toLowerCase();
    let raw: string;

    if (contentLLM === "gemini") {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) return NextResponse.json({ error: "Gemini not configured" }, { status: 503 });
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts: [{ text: userMessage }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: isBlog ? 8000 : isProduct ? 3000 : 4000,
            },
          }),
        }
      );
      if (!geminiRes.ok) {
        const err = await geminiRes.text();
        console.error("Gemini API:", err);
        return NextResponse.json({ error: "AI generation failed" }, { status: 502 });
      }
      const geminiData = (await geminiRes.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      raw = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    } else {
      const key = process.env.DEEPSEEK_API_KEY;
      if (!key) return NextResponse.json({ error: "DeepSeek not configured" }, { status: 503 });
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
            { role: "user", content: userMessage },
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
      raw = data.choices?.[0]?.message?.content ?? "";
    }

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
          if (out.content) {
            await insertAiLog({
              log_type: "content_generate",
              content_type: contentType,
              entity_type: "post",
              model_used: contentLLM,
              prompt_sent: systemPrompt,
              result_preview: typeof out.content === "string" ? out.content.slice(0, 500) : JSON.stringify(out).slice(0, 500),
              admin_email: admin?.email,
            });
            return NextResponse.json(out);
          }
        }

        if (isProduct) {
          for (const k of ["description", "who_its_for", "outcome", "no_refunds_note", "image_prompt"]) {
            const v = parsed[k];
            if (typeof v === "string") out[k] = v;
          }
          if (Array.isArray(parsed.whats_included)) out.whats_included = parsed.whats_included;
          if (Array.isArray(parsed.faq)) out.faq = parsed.faq;
          if (out.description || out.who_its_for) {
            await insertAiLog({
              log_type: "content_generate",
              content_type: contentType,
              entity_type: "product",
              model_used: contentLLM,
              prompt_sent: systemPrompt,
              result_preview: JSON.stringify(out).slice(0, 500),
              admin_email: admin?.email,
            });
            return NextResponse.json(out);
          }
        }
      } catch {
        // Fallback: return content only
      }
    }

    await insertAiLog({
      log_type: "content_generate",
      content_type: contentType,
      model_used: contentLLM,
      prompt_sent: systemPrompt,
      result_preview: raw.slice(0, 500),
      admin_email: admin?.email,
    });
    return NextResponse.json({ content: raw });
  } catch (e) {
    console.error("AI generate:", e);
    return NextResponse.json({ error: "Failed to generate" }, { status: 500 });
  }
}
