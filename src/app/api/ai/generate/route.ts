import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { getPrompt, getListPrompt, type ContentType } from "@/lib/ai/prompts";
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
      "carousel",
      "grammar",
      "vocabulary",
      "kanji",
      "reading",
      "listening",
      "writing",
      "sounds",
      "study_guide",
      "practice_test",
      "product",
    ];
    if (!contentType || !validTypes.includes(contentType)) {
      return NextResponse.json({ error: "Invalid contentType" }, { status: 400 });
    }

    const context = (body.context as Record<string, string>) || {};
    const customPrompt = typeof body.customPrompt === "string" ? body.customPrompt.trim() : "";
    const generateList = body.generateList === true || body.mode === "list";

    const systemPrompt = generateList
      ? customPrompt || getListPrompt(contentType, context as Parameters<typeof getListPrompt>[1])
      : customPrompt || getPrompt(contentType, context as Parameters<typeof getPrompt>[1]);
    const isBlog = contentType === "blog";
    const isProduct = contentType === "product";
    const isLearn =
      contentType === "grammar" || contentType === "vocabulary" || contentType === "kanji";
    const isJsonResponse = isBlog || isProduct || isLearn;
    const userMessage = generateList
      ? "Generate the list. Return ONLY a valid JSON array. No markdown code blocks, no text before or after the array."
      : isBlog
        ? "Generate the blog post. Return ONLY a valid JSON object with keys: content, title, slug, tags, jlpt_level, seo_title, seo_description, image_prompt, section_image_prompts. No markdown code blocks, no extra text."
        : isProduct
          ? "Generate the product copy. Return ONLY a valid JSON object with keys: description, who_its_for, outcome, whats_included, faq, no_refunds_note, image_prompt. No markdown code blocks, no extra text."
          : isLearn
            ? "Generate the lesson. Return ONLY a valid JSON object with keys: content, feature_image_prompt, image_prompt_items. content must be Markdown. image_prompt_items must be an array of objects: { placeholder, role, aspect_ratio, prompt }. No markdown code blocks, no extra text."
          : "Generate the content as described.";

    const contentLLM = ((body.content_llm as string) || process.env.CONTENT_LLM || "deepseek").toLowerCase();
    const model = contentLLM === "gemini" ? "gemini" : "deepseek";
    const maxTokensRequested = generateList ? 16000 : isBlog ? 8000 : isProduct ? 3000 : 4000;
    /** DeepSeek allows max 8192; Gemini can use higher. */
    const maxTokens = model === "deepseek" ? Math.min(maxTokensRequested, 8192) : maxTokensRequested;
    let raw: string;

    if (model === "gemini") {
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
              maxOutputTokens: maxTokens,
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
          max_tokens: maxTokens,
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

    if (generateList) {
      try {
        const extracted = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        const parsed = JSON.parse(extracted);
        const list = Array.isArray(parsed) ? parsed : [];
        await insertAiLog({
          log_type: "content_generate",
          content_type: contentType,
          entity_type: "list",
          model_used: model,
          prompt_sent: systemPrompt,
          result_preview: `Generated ${list.length} items`,
          admin_email: admin?.email,
        });
        return NextResponse.json({ list });
      } catch {
        // Fallback: return raw so user can copy
        return NextResponse.json({ list: [], raw });
      }
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
              model_used: model,
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
              model_used: model,
              prompt_sent: systemPrompt,
              result_preview: JSON.stringify(out).slice(0, 500),
              admin_email: admin?.email,
            });
            return NextResponse.json(out);
          }
        }

        if (isLearn) {
          for (const k of ["content", "feature_image_prompt"]) {
            const v = parsed[k];
            if (typeof v === "string") out[k] = v;
          }
          const items = parsed.image_prompt_items;
          if (Array.isArray(items) && items.length > 0) {
            out.image_prompt_items = items.filter(
              (p: unknown) =>
                p &&
                typeof p === "object" &&
                "placeholder" in p &&
                "role" in p &&
                "prompt" in p
            );
          }
          if (typeof out.content === "string") {
            await insertAiLog({
              log_type: "content_generate",
              content_type: contentType,
              entity_type: "learning_content",
              model_used: model,
              prompt_sent: systemPrompt,
              result_preview: out.content.slice(0, 500),
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
      model_used: model,
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
