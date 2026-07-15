import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { neon } = await import("@neondatabase/serverless");
  const { PutObjectCommand, S3Client } = await import("@aws-sdk/client-s3");
  const { getImagePrompt } = await import("../src/lib/ai/image-prompts");
  const { generateImageWithGemini } = await import("../src/lib/ai/image-providers/gemini");
  const { generateImageWithHuggingFace } = await import("../src/lib/ai/image-providers/huggingface");
  const { insertAiLog } = await import("../src/lib/ai-logs");

  const sql = neon(process.env.DATABASE_URL!);
  const r2 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
  });
  const bucket = process.env.R2_BUCKET_NAME!;
  const bucketUrl = process.env.R2_BUCKET_URL!.replace(/\/$/, "");

  const rows = (await sql`
    SELECT slug, title, summary, jlpt_level, tags
    FROM posts
    WHERE content_type = 'blog' AND (og_image_url IS NULL OR og_image_url = '')
    ORDER BY created_at DESC
  `) as { slug: string; title: string; summary: string | null; jlpt_level: string[] | null; tags: string[] | null }[];

  console.log(`Found ${rows.length} blog posts missing images.`);

  for (const row of rows) {
    const level = Array.isArray(row.jlpt_level) && row.jlpt_level.length > 0 ? row.jlpt_level[0] : "N5";
    const prompt = getImagePrompt("blog", {
      title: row.title,
      jlptLevel: level,
      tags: Array.isArray(row.tags) ? row.tags.join(", ") : undefined,
      description: row.summary ?? undefined,
    });

    let generated: { buffer: Buffer; mime: string; textResponse?: string } | null = null;
    let modelUsed = "";
    const errors: string[] = [];
    try {
      generated = await generateImageWithGemini(prompt);
      modelUsed = "gemini";
    } catch (e) {
      errors.push(`gemini: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!generated) {
      try {
        generated = await generateImageWithHuggingFace(prompt);
        modelUsed = "huggingface-z-image";
      } catch (e) {
        errors.push(`huggingface: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (!generated) {
      console.error(`[${row.slug}] FAILED (gemini + huggingface): ${errors.join(" | ")} — run this slug through the admin "Generate image" UI to fall through to the DeepSeek-HTML card renderer.`);
      continue;
    }

    const { buffer, mime, textResponse } = generated;
    const ext = mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : "png";
    const key = `blog/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    await r2.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: mime }));
    const publicUrl = `${bucketUrl}/${key}`;

    await sql`UPDATE posts SET og_image_url = ${publicUrl}, image_prompt = ${prompt}, updated_at = NOW() WHERE slug = ${row.slug}`;

    await insertAiLog({
      log_type: "image_generate",
      content_type: "blog",
      entity_type: "post",
      model_used: modelUsed,
      prompt_sent: prompt,
      result_preview: publicUrl,
      admin_email: "script:generate-blog-images",
    });

    console.log(`[${row.slug}] OK (${modelUsed}) -> ${publicUrl}${textResponse ? "" : ""}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
