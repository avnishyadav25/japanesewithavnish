import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getImagePrompt, type ImageType } from "@/lib/ai/image-prompts";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const validImageTypes: ImageType[] = ["product", "blog", "newsletter", "page", "learning"];
const BUCKET = "files";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
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
    if (!imageType || !validImageTypes.includes(imageType)) {
      return NextResponse.json({ error: "Invalid imageType" }, { status: 400 });
    }

    const context = (body.context as Record<string, string>) || {};
    const userPrompt = (body.prompt as string) || getImagePrompt(imageType, context);

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
      const admin = createAdminClient();
      const mime = imagePart.inlineData.mimeType || "image/png";
      const ext = mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : "png";
      const folder = imageType; // blog | product | newsletter | page | learning
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { data: bucketList } = await admin.storage.listBuckets();
      const bucketExists = bucketList?.some((b) => b.name === BUCKET);
      if (!bucketExists) {
        await admin.storage.createBucket(BUCKET, { public: true });
      }

      const buf = Buffer.from(imagePart.inlineData.data, "base64");
      const { error: uploadErr } = await admin.storage.from(BUCKET).upload(path, buf, {
        contentType: mime,
        upsert: true,
      });

      if (uploadErr) {
        console.error("Storage upload:", uploadErr);
        return NextResponse.json(
          { error: `Upload failed: ${uploadErr.message}` },
          { status: 500 }
        );
      }

      const {
        data: { publicUrl },
      } = admin.storage.from(BUCKET).getPublicUrl(path);

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
