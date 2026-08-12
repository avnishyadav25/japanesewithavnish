import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { R2_NOT_CONFIGURED_MESSAGE, getR2, uploadToR2 } from "@/lib/r2";
import { getImagePrompt, type ImageType } from "@/lib/ai/image-prompts";
import { getPromptContent } from "@/lib/ai/load-prompts";
import { insertAiLog } from "@/lib/ai-logs";
import { generateImageWithGemini, type GeneratedImage } from "@/lib/ai/image-providers/gemini";
import { generateImageWithHuggingFace } from "@/lib/ai/image-providers/huggingface";
import { generateImageWithDeepSeekHtml } from "@/lib/ai/image-providers/deepseek-html";
import { compressGeneratedImage } from "@/lib/ai/compress-image";

const validImageTypes: ImageType[] = ["product", "blog", "newsletter", "page", "learning", "curriculum"];

// Content types with their own DB-editable image prompt (ai_prompts key
// "learning_{type}_image") — see ALLOWED_PROMPT_KEYS in src/lib/ai/load-prompts.ts.
const LEARNING_IMAGE_PROMPT_TYPES = new Set(["vocabulary", "grammar", "kanji"]);

export async function POST(req: Request) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const imageType = body.imageType as ImageType;
    const promptOverride = body.prompt as string | undefined;
    const aspectRatio = body.aspectRatio as string | undefined;
    const referenceImageUrl = body.referenceImageUrl as string | undefined;

    if (!imageType || !validImageTypes.includes(imageType)) {
      return NextResponse.json({ error: "Invalid imageType" }, { status: 400 });
    }

    const context = (body.context as Record<string, string>) || {};
    let userPrompt: string;
    if (promptOverride?.trim()) {
      userPrompt = promptOverride.trim();
    } else if (imageType === "curriculum") {
      const dbPrompt = await getPromptContent("curriculum_feature_image");
      const title = context.title || context.topic || "Japanese with Avnish";
      const entityType = context.entityType || "lesson";
      if (dbPrompt?.trim()) {
        userPrompt = dbPrompt
          .replace(/\{\{title\}\}/g, title)
          .replace(/\{\{entityType\}\}/g, entityType);
      } else {
        userPrompt = getImagePrompt(imageType, context);
      }
    } else if (imageType === "learning" && context.contentType && LEARNING_IMAGE_PROMPT_TYPES.has(context.contentType)) {
      // Per-content-type DB-editable override (e.g. learning_vocabulary_image),
      // same pattern as curriculum_feature_image above — falls back to the
      // hardcoded generic "learning" template if no override is set.
      const dbPrompt = await getPromptContent(`learning_${context.contentType}_image`);
      if (dbPrompt?.trim()) {
        const title = context.title || context.topic || "Japanese with Avnish";
        userPrompt = dbPrompt
          .replace(/\{\{title\}\}/g, title)
          .replace(/\{\{jlptLevel\}\}/g, context.jlptLevel || "")
          .replace(/\{\{contentType\}\}/g, context.contentType);
      } else {
        userPrompt = getImagePrompt(imageType, context);
      }
    } else {
      userPrompt = getImagePrompt(imageType, context);
    }
    if (aspectRatio?.trim()) {
      userPrompt = `${userPrompt}\nAspect ratio ${aspectRatio.trim()}.`;
    }
    if (referenceImageUrl?.trim()) {
      userPrompt = `${userPrompt}

Use the reference image for style and mood. Clean flat-vector educational style. Minimal study desk with open notebook, hiragana chart (あ い う え お), katakana chart (カ キ ク ケ コ), simple kanji cards (日, 学, 語), pencil, and headphones where relevant. Background soft off-white (#FAF8F5) with subtle cherry blossom petals and faint torii gate outline. Calm academic atmosphere, lots of white space, balanced composition. Style: flat vector illustration, minimal Japanese aesthetic, clean typography. Lighting bright and soft. Include Japanese student or learner silhouette if it fits the scene. Negative prompt: no anime, no people faces, no clutter, no neon colors.`;
    }

    // Reel (9:16) and carousel/post (1:1): ensure site URL at bottom
    const ar = aspectRatio?.trim()?.toLowerCase();
    if (ar === "9:16" || ar === "1:1") {
      userPrompt = `${userPrompt}\n\nAt the bottom of the image, display the text japanesewithavnish.com in clean, readable typography (subtle but legible).`;
    }

    // Provider fallback chain: Gemini first, then HuggingFace (Z-Image via fal-ai),
    // then DeepSeek-authored HTML card rendered via next/og as a last resort.
    let generated: GeneratedImage | null = null;
    let modelUsed = "";
    const providerErrors: string[] = [];

    try {
      generated = await generateImageWithGemini(userPrompt);
      modelUsed = "gemini";
    } catch (e) {
      providerErrors.push(`gemini: ${e instanceof Error ? e.message : String(e)}`);
    }

    if (!generated) {
      try {
        generated = await generateImageWithHuggingFace(userPrompt);
        modelUsed = "huggingface-z-image";
      } catch (e) {
        providerErrors.push(`huggingface: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (!generated) {
      try {
        generated = await generateImageWithDeepSeekHtml(userPrompt);
        modelUsed = "deepseek-html-card";
      } catch (e) {
        providerErrors.push(`deepseek-html: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (!generated) {
      console.error("All image providers failed:", providerErrors);
      return NextResponse.json({ error: `Image generation failed on all providers: ${providerErrors.join("; ")}` }, { status: 502 });
    }

    const { textResponse } = generated;
    const { buffer, mime } = await compressGeneratedImage(generated.buffer);
    const ext = mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : "png";
    const folder = imageType;
    const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    if (!getR2()) return NextResponse.json({ error: R2_NOT_CONFIGURED_MESSAGE }, { status: 503 });

    // cacheControl: null preserves the pre-refactor behaviour of sending no Cache-Control.
    const publicUrl = await uploadToR2(key, buffer, mime, { cacheControl: null });
    await insertAiLog({
      log_type: "image_generate",
      content_type: imageType,
      entity_type: imageType === "blog" ? "post" : imageType === "product" ? "product" : imageType === "newsletter" ? "newsletter" : undefined,
      model_used: modelUsed,
      prompt_sent: userPrompt,
      result_preview: publicUrl,
      admin_email: admin?.email,
    });
    return NextResponse.json({ imageUrl: publicUrl, content: textResponse ?? "" });
  } catch (e) {
    console.error("AI generate-image:", e);
    const msg = e instanceof Error ? e.message : "Failed to generate";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
