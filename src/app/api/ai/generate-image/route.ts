import { NextResponse } from "next/server";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getAdminSession } from "@/lib/auth/admin";
import { getImagePrompt, type ImageType } from "@/lib/ai/image-prompts";
import { insertAiLog } from "@/lib/ai-logs";

const validImageTypes: ImageType[] = ["product", "blog", "newsletter", "page", "learning"];

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

    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    const geminiImageModel =
      process.env.GEMINI_IMAGE_MODEL || "gemini-2.0-flash-preview-image-generation";

    if (!key) {
      return NextResponse.json(
        { error: "Gemini not configured. Set GEMINI_API_KEY in .env." },
        { status: 503 }
      );
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
    let userPrompt: string =
      promptOverride?.trim() || getImagePrompt(imageType, context);
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

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiImageModel}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 2048,
            responseModalities: ["TEXT", "IMAGE"],
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      console.error("Gemini API:", err);
      let msg = "Image generation failed";
      try {
        const errJson = JSON.parse(err);
        msg = errJson.error?.message || msg;
      } catch {
        // use default
      }
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const data = await geminiRes.json();
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const text = parts.find((p: { text?: string }) => p.text)?.text ?? "";

    // Look for inline image data in response
    const imagePart = parts.find(
      (p: { inlineData?: { mimeType?: string; data?: string } }) => p.inlineData?.data
    );
    if (imagePart?.inlineData?.data) {
      const mime = imagePart.inlineData.mimeType || "image/png";
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

      const buf = Buffer.from(imagePart.inlineData.data, "base64");
      await r2.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buf,
          ContentType: mime,
        })
      );

      const publicUrl = `${bucketUrl}/${key}`;
      const admin = await getAdminSession();
      await insertAiLog({
        log_type: "image_generate",
        content_type: imageType,
        entity_type: imageType === "blog" ? "post" : imageType === "product" ? "product" : imageType === "newsletter" ? "newsletter" : undefined,
        model_used: "gemini",
        prompt_sent: userPrompt,
        result_preview: publicUrl,
        admin_email: admin?.email,
      });
      return NextResponse.json({ imageUrl: publicUrl, content: text });
    }

    // No image in response - model may not support image gen yet
    return NextResponse.json({
      error:
        "No image in response. Ensure GEMINI_IMAGE_MODEL supports image generation (e.g. gemini-2.0-flash-preview-image-generation).",
      content: text,
    });
  } catch (e) {
    console.error("AI generate-image:", e);
    const msg = e instanceof Error ? e.message : "Failed to generate";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
