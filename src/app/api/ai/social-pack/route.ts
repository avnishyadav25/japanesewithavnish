import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";
const GEMINI_TEXT_MODEL = "gemini-2.0-flash";

const SOCIAL_PACK_SYSTEM = `You are an expert content creator for Japanese with Avnish (japanesewithavnish.com) — a JLPT learning site. Generate a complete multi-platform content pack for ONE topic (a blog, product, or newsletter).

RULES:
1) Output ONLY valid JSON. No markdown, no commentary, no trailing commas. Every string value must be in double quotes, including all hashtags (e.g. "hashtags": ["#JLPT", "#Japanese"], never unquoted #tag).
2) Use simple English for all copy (professional, calm, helpful). No Hinglish unless requested.
3) Audience: people learning Japanese, JLPT aspirants (N5–N1).
4) Include CTA: visit the site, check the blog/product, or subscribe.
5) Instagram carousel: exactly 10 slides; each slide body max 180 characters. Each slide must have title, body, and on_screen_caption. For on_screen_caption: write a DETAILED educational image-generation prompt (2–3 sentences) that clearly describes the visual — e.g. study desk with open textbook showing a specific grammar point, hiragana/katakana chart, kanji flashcard, notebook with example sentences, soft off-white background (#FAF8F5), minimal Japanese aesthetic, clear typography. Every carousel image prompt MUST end with: "At the bottom of the image, display the text japanesewithavnish.com in clean, readable typography."
6) Instagram reel: 8–12 shots. Each shot.visual must be a DETAILED educational prompt for AI image generation (2–3 sentences): describe the exact scene (e.g. study desk with JLPT textbook open to a vocabulary list, hiragana chart (あ い う え お) visible, notebook with example sentence, pencil, headphones; soft off-white background, cherry blossom accent, calm academic mood). Be specific and educational. Every reel shot.visual MUST end with: "At the bottom of the image, display the text japanesewithavnish.com in clean, readable typography." Include caption_hinglish, hashtags, cta_line for the reel caption.
7) Instagram post: caption_hinglish, hashtags, cta_line; add post.image_prompt as a single detailed educational prompt for one square (1:1) post image (clear scene description, japanesewithavnish.com at the bottom).
8) Twitter and LinkedIn: post text plus image_prompt (one short prompt for a single share image each).
9) Reddit: post with title, body, image_prompt. Pinterest: pin with title, description, image_prompt. All image_prompt fields are for AI image generation; keep them concise and visual.
10) validation: set is_valid_json true, carousel_slides_count 10, reel_has_8_to_12_shots true, safe_to_publish true.

Return this exact JSON shape (all keys; use "" or [] where empty):
{"meta":{"topic":"","content_angle":"","primary_pain":"","big_payoff":"","audience":"JLPT learners","cta_keyword":"","lead_magnet":""},"youtube":{"long":{"title":"","hook_1_line":"","outline_bullets":[],"script":"","description":"","chapters":[{"t":"0:00","label":""}],"tags":[],"pinned_comment":"","thumbnail":{"text_options":[],"visual_concept":"","composition_notes":""}},"short":{"title":"","script":"","on_screen_beats":[],"description":"","hashtags":[]}},"instagram":{"reel":{"duration_sec":40,"hook_text":"","shots":[{"t_start":"0:00","t_end":"0:03","visual":"","on_screen_text":"","voiceover_hinglish":"","sfx":""}],"caption_hinglish":"","hashtags":[],"cta_line":""},"post":{"caption_hinglish":"","hashtags":[],"cta_line":"","image_prompt":""},"carousel":{"cover":{"headline":"","subheadline":"","badge":""},"slides":[{"slide_no":1,"title":"","body":"","on_screen_caption":""},{"slide_no":2,"title":"","body":"","on_screen_caption":""},{"slide_no":3,"title":"","body":"","on_screen_caption":""},{"slide_no":4,"title":"","body":"","on_screen_caption":""},{"slide_no":5,"title":"","body":"","on_screen_caption":""},{"slide_no":6,"title":"","body":"","on_screen_caption":""},{"slide_no":7,"title":"","body":"","on_screen_caption":""},{"slide_no":8,"title":"","body":"","on_screen_caption":""},{"slide_no":9,"title":"","body":"","on_screen_caption":""},{"slide_no":10,"title":"","body":"","on_screen_caption":""}],"design":{"format":"1080x1350","style":"minimal","colors":{"bg":"#0B1220","text":"#FFFFFF","accent1":"#7C3AED","accent2":"#22C55E"},"font_suggestions":["Inter"],"layout_rules":[]}},"facebook":{"post":{"text":"","cta_line":""}},"threads":{"post":{"text":""}},"twitter":{"post":{"text":""},"thread":{"tweets":[]},"image_prompt":""},"linkedin":{"post":{"text":"","cta_line":""},"article":{"title":"","hook":"","tldr":"","body":"","hashtags":[]},"image_prompt":""},"reddit":{"post":{"title":"","body":"","image_prompt":""}},"pinterest":{"pin":{"title":"","description":"","image_prompt":""}},"blog":{"title":"","slug":"","tldr":"","meta_title":"","meta_description":"","html_body":"","tags":[],"image_prompt":""},"assets":{"screen_recording_list":[],"broll_ideas":[],"thumbnail":{"text_options":[],"visual_concept":"","composition_notes":""}},"validation":{"is_valid_json":true,"carousel_slides_count":10,"reel_has_8_to_12_shots":true,"safe_to_publish":true,"warnings":[]}}`;

export async function POST(req: Request) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const contentType = (body.contentType as string) || "blog";
    const slug = String(body.slug ?? "").trim();
    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").slice(0, 6000);
    const summary = String(body.summary ?? "").slice(0, 2000);
    const link = String(body.link ?? "");
    const entityId = body.entity_id ?? null;
    const customUserPrompt = (body.user_prompt as string)?.trim();

    if (!title && !customUserPrompt) return NextResponse.json({ error: "Title required (or provide user_prompt)" }, { status: 400 });

    const userPrompt =
      customUserPrompt ||
      `Content type: ${contentType}. Topic/Title: ${title}. ${summary ? `Summary: ${summary}. ` : ""}${description ? `Description: ${description}. ` : ""}${link ? `Link: ${link}. ` : ""}Generate the full content pack JSON.`;

    const contentLLM = ((body.content_llm as string) || process.env.CONTENT_LLM || "deepseek").toLowerCase();
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
            systemInstruction: { parts: [{ text: SOCIAL_PACK_SYSTEM }] },
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: { temperature: 0.6, maxOutputTokens: 8000 },
          }),
        }
      );
      if (!geminiRes.ok) {
        const err = await geminiRes.text();
        console.error("Social pack Gemini:", err);
        return NextResponse.json({ error: "AI generation failed" }, { status: 502 });
      }
      const geminiData = (await geminiRes.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      raw = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    } else {
      const key = process.env.DEEPSEEK_API_KEY;
      if (!key) return NextResponse.json({ error: "DeepSeek not configured" }, { status: 503 });
      const res = await fetch(DEEPSEEK_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: SOCIAL_PACK_SYSTEM },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.6,
          max_tokens: 8000,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error("Social pack DeepSeek:", err);
        return NextResponse.json({ error: "AI generation failed" }, { status: 502 });
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      raw = data.choices?.[0]?.message?.content ?? "";
    }

    let cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    // Extract JSON object if there is leading/trailing text (e.g. "Here is the JSON:\n{...}")
    const firstBrace = cleaned.indexOf("{");
    if (firstBrace !== -1) {
      const lastBrace = cleaned.lastIndexOf("}");
      if (lastBrace > firstBrace) cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }
    // Remove trailing commas before ] or } (invalid in JSON, common in LLM output)
    cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1");
    // Fix unquoted hashtags (e.g. "#JLPT", #Japanese -> "#JLPT", "#Japanese") so JSON parses
    cleaned = cleaned.replace(/,(\s*)#([a-zA-Z0-9_-]+)(?=\s*[,}\]])/g, '$1"#$2"');
    cleaned = cleaned.replace(/\[\s*#([a-zA-Z0-9_-]+)(?=\s*[,}\]])/g, '[ "#$1"');
    cleaned = cleaned.replace(/:(\s*)#([a-zA-Z0-9_-]+)(?=\s*[,}\]])/g, ':$1"#$2"');
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(cleaned) as Record<string, unknown>;
    } catch (e) {
      console.error("Social pack JSON parse error:", e instanceof Error ? e.message : e);
      console.error("Cleaned length:", cleaned.length, "preview:", cleaned.slice(0, 300));
      return NextResponse.json({ error: "Invalid JSON from AI. Try again or use a different model." }, { status: 502 });
    }

    const packSlug = slug || title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const packTitle = title;

    if (!sql) return NextResponse.json({ packId: null, payload });

    const referenceImageUrl = (body.reference_image_url as string)?.trim() || null;
    const payloadJson = JSON.stringify(payload);
    const rows = await sql`
      INSERT INTO social_content_packs (entity_type, entity_id, slug, title, description, summary, link, reference_image_url, payload, updated_at)
      VALUES (${contentType}, ${entityId}, ${packSlug}, ${packTitle}, ${description || null}, ${summary || null}, ${link || null}, ${referenceImageUrl}, ${payloadJson}::jsonb, ${new Date().toISOString()})
      RETURNING id
    ` as { id: string }[];
    const packId = rows[0]?.id ?? null;

    return NextResponse.json({ packId, payload });
  } catch (e) {
    console.error("Social pack:", e);
    return NextResponse.json({ error: "Failed to generate pack" }, { status: 500 });
  }
}
