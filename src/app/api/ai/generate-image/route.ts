import { NextResponse } from "next/server";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getAdminSession } from "@/lib/auth/admin";
import { getImagePrompt, type ImageType } from "@/lib/ai/image-prompts";
import { getPromptContent } from "@/lib/ai/load-prompts";
import { insertAiLog } from "@/lib/ai-logs";
import { generateImageWithGemini, type GeneratedImage } from "@/lib/ai/image-providers/gemini";
import { generateImageWithHuggingFace } from "@/lib/ai/image-providers/huggingface";
import { generateImageWithDeepSeekHtml } from "@/lib/ai/image-providers/deepseek-html";

const validImageTypes: ImageType[] = ["product", "blog", "newsletter", "page", "learning", "curriculum"];

function getR2Client(): S3Client | null {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKey || !secretKey) return null;
  return new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });
}

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

    const { buffer, mime, textResponse } = generated;
    const ext = mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : "png";
    const folder = imageType;
    const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const r2 = getR2Client();
    const bucket = process.env.R2_BUCKET_NAME;
    const bucketUrl = process.env.R2_BUCKET_URL?.replace(/\/$/, "");

    if (!r2 || !bucket || !bucketUrl) {
      return NextResponse.json(
        { error: "R2 not configured. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_BUCKET_URL." },
        { status: 503 }
      );
    }

    await r2.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mime,
      })
    );

    const publicUrl = `${bucketUrl}/${key}`;
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
