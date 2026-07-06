import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL required in .env");
  process.exit(1);
}
const sql = neon(DATABASE_URL);

// S3 R2 Client Config
const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT || "",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});
const bucketName = process.env.R2_BUCKET_NAME || "";
const bucketUrl = process.env.R2_BUCKET_URL || "";

// LLM settings
const geminiKey = process.env.GEMINI_API_KEY;
const imageModel = process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image-preview";

// Helper: Slugify title
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

// Helper: Call Gemini model
async function callGemini(systemPrompt: string, userMessage: string, maxTokens: number): Promise<string> {
  if (!geminiKey) throw new Error("GEMINI_API_KEY is not configured.");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini LLM call failed: ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// Helper: Clean markdown fences
function stripFences(raw: string): string {
  return raw.replace(/^```\w*\n?|\n?```$/g, "").trim();
}

function cleanJSONString(raw: string): string {
  let clean = stripFences(raw);
  const firstIndex = Math.min(
    clean.indexOf("[") === -1 ? Infinity : clean.indexOf("["),
    clean.indexOf("{") === -1 ? Infinity : clean.indexOf("{")
  );
  const lastIndex = Math.max(clean.lastIndexOf("]"), clean.lastIndexOf("}"));
  if (firstIndex !== Infinity && lastIndex !== -1 && lastIndex > firstIndex) {
    clean = clean.substring(firstIndex, lastIndex + 1).trim();
  }
  clean = clean.replace(/,\s*([\]}])/g, "$1");
  clean = clean.replace(/[\u201C\u201D]/g, '"');
  clean = clean.replace(/[\u2018\u2019]/g, "'");
  return clean;
}

// Helper: Generate Image with Text Overlay and upload to R2
async function generateCoverWithOverlay(title: string, romaji: string, category: string): Promise<string | null> {
  if (!geminiKey || !bucketName || !bucketUrl) return null;

  const prompt = `Anime vector style clean educational card cover representing the Japanese term: "${title}" (Romaji: "${romaji}"). The Japanese character "${title}" and its Romaji "${romaji}" should be clearly visible and overlayed directly onto the illustration, as beautiful, styled typography text. Vibrant colors, educational layout. Negative prompt: photographic, real life, low quality, messy text.`;

  console.log(`      🎨 Generating image for "${title}" with text overlay...`);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 2048,
            responseModalities: ["TEXT", "IMAGE"],
          },
        }),
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p: any) => p.inlineData?.data);

    if (imagePart?.inlineData?.data) {
      const mime = imagePart.inlineData.mimeType || "image/png";
      const ext = mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : "png";
      const fileKey = `covers/${slugify(category)}-${slugify(title)}-${Date.now()}.${ext}`;

      const buf = Buffer.from(imagePart.inlineData.data, "base64");
      await r2.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: fileKey,
          Body: buf,
          ContentType: mime,
        })
      );
      return `${bucketUrl.replace(/\/$/, "")}/${fileKey}`;
    }
  } catch (e) {
    console.error("      ❌ Image generation error:", e);
  }
  return null;
}

// Main Runner
async function run() {
  console.log("🚀 Starting Sequential Curriculum Enhancer...");

  // 1. Fetch all learning content posts
  const posts = await sql`
    SELECT id, slug, title, content_type, (jlpt_level)[1] as level, meta, og_image_url
    FROM posts
    WHERE content_type IN ('grammar', 'vocabulary', 'kanji', 'reading', 'listening', 'writing')
    ORDER BY created_at DESC
  ` as { id: string; slug: string; title: string; content_type: string; level: string | null; meta: any; og_image_url: string | null }[];

  console.log(`Found ${posts.length} curriculum items to inspect.`);

  let index = 1;
  for (const post of posts) {
    console.log(`\n--------------------------------------------------`);
    console.log(`📦 [${index}/${posts.length}] Category: ${post.content_type.toUpperCase()} | Item: "${post.title}" (${post.level})`);
    console.log(`--------------------------------------------------`);

    let meta = post.meta && typeof post.meta === "object" && !Array.isArray(post.meta) ? { ...post.meta } : {};
    let dbUpdated = false;

    // A. Determine Romaji / Reading
    let romaji = "";
    if (post.content_type === "vocabulary") {
      romaji = String(meta.reading || post.title);
    } else if (post.content_type === "kanji") {
      romaji = String(meta.meaning || "");
    } else if (post.content_type === "grammar") {
      romaji = String(meta.meaning || "");
    }

    // B. Fix Cover image if missing or gradient
    if (!post.og_image_url) {
      const coverUrl = await generateCoverWithOverlay(post.title, romaji, post.content_type);
      if (coverUrl) {
        post.og_image_url = coverUrl;
        meta.feature_image_url = coverUrl;
        await sql`UPDATE posts SET og_image_url = ${coverUrl} WHERE id = ${post.id}`;
        dbUpdated = true;
        console.log(`   ✅ Cover Image generated: ${coverUrl}`);
      }
    }

    // C. Generate 5-6 example sentences if missing
    const examples = Array.isArray(meta.examples) ? meta.examples : [];
    if (examples.length < 5) {
      console.log("   📝 Examples missing or less than 5. Generating 6 examples...");
      try {
        const sys = "You are a Japanese professor. Output ONLY a valid JSON array of 6 educational example sentences showing correct usage. Format: [{\"japanese\":\"...\",\"romaji\":\"...\",\"translation\":\"...\"}]. Strictly double quotes, no thought blocks.";
        const user = `Category: ${post.content_type}. Term: "${post.title}" (${romaji}). Level: ${post.level}. Generate 6 natural examples.`;
        const res = await callGemini(sys, user, 1800);
        const generatedList = JSON.parse(cleanJSONString(res));
        if (Array.isArray(generatedList) && generatedList.length > 0) {
          meta.examples = generatedList;
          dbUpdated = true;
          console.log(`   ✅ Successfully added ${generatedList.length} examples.`);
        }
      } catch (e) {
        console.error("   ❌ Failed to generate examples:", e);
      }
    }

    // D. Generate stroke SVG paths for writing / kanji if missing
    if (post.content_type === "kanji") {
      let strokeDataRows = await sql`SELECT stroke_data, stroke_count FROM kanji WHERE post_id = ${post.id}` as { stroke_data: any; stroke_count: number | null }[];
      let strokeData = strokeDataRows[0]?.stroke_data;
      let strokeCount = strokeDataRows[0]?.stroke_count;

      if (!strokeCount || !strokeData || !Array.isArray(strokeData) || strokeData.length === 0) {
        console.log("   ✍️ Stroke data / stroke count missing. Generating tracing coordinates...");
        try {
          const sys = "You are a Kanji stroke order expert. Output ONLY a valid JSON array of SVG path strings representing the strokes in sequence for the character. Grid size is 109x109. Example: [\"M 10 20 L 90 20\", \"M 50 10 L 50 90\"]. Return ONLY the JSON array, no thought blocks.";
          const user = `Kanji Character: "${post.title}". Output the stroke order paths array.`;
          const res = await callGemini(sys, user, 1500);
          const paths = JSON.parse(cleanJSONString(res));
          if (Array.isArray(paths) && paths.length > 0) {
            await sql`
              UPDATE kanji
              SET stroke_count = ${paths.length}, stroke_data = ${JSON.stringify(paths)}::jsonb, updated_at = NOW()
              WHERE post_id = ${post.id}
            `;
            console.log(`   ✅ Stroke order verified: ${paths.length} strokes.`);
          }
        } catch (e) {
          console.error("   ❌ Failed to generate strokes:", e);
        }
      }
    }

    // E. Save meta updates to posts table
    if (dbUpdated) {
      await sql`
        UPDATE posts
        SET meta = ${JSON.stringify(meta)}::jsonb, updated_at = NOW()
        WHERE id = ${post.id}
      `;
      console.log("   ✅ Saved post meta metadata.");
    }

    // Slight sequential delay to avoid Gemini rate limits
    await new Promise((resolve) => setTimeout(resolve, 1500));
    index++;
  }

  console.log("\n🎉 Sequential seeder completed successfully!");
  process.exit(0);
}

run().catch(console.error);
