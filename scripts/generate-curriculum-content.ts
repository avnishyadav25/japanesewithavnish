import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import * as fs from "fs";
import * as path from "path";

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
const imageModel = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

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

// Helper: Hash code
function hashCode(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h | 0;
}

// Helper: Call Gemini model
async function callGemini(systemPrompt: string, userMessage: string, maxTokens: number): Promise<string> {
  if (!geminiKey) throw new Error("GEMINI_API_KEY is not configured.");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
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

// Helper: Clean markdown code fences
function stripFences(raw: string): string {
  return raw.replace(/^```\w*\n?|\n?```$/g, "").trim();
}

// Helper: Load prompt from DB
async function loadPrompt(key: string, fallback: string): Promise<string> {
  try {
    const rows = await sql`SELECT content FROM ai_prompts WHERE key = ${key} LIMIT 1`;
    return (rows as { content: string }[])?.[0]?.content ?? fallback;
  } catch {
    return fallback;
  }
}

// Helper: Generate Image and upload to R2
async function generateAndUploadImage(title: string, entityType: string): Promise<string | null> {
  if (!geminiKey || !bucketName || !bucketUrl) {
    console.log("    ⚠️ Skipping image generation (Gemini/R2 configs missing)");
    return null;
  }

  // Create prompt with cartoon/anime styling + Japanese characters
  const prompt = `Anime/cartoon style clean vector illustration representing the Japanese language topic: "${title}". Beautiful anime artwork, vibrant colors, clear outline aesthetic, with some relevant Japanese characters or kana visible. High quality educational study material. Negative prompt: photographic, real life, clutter, low quality, photorealistic, ugly.`;

  console.log(`    🎨 Generating ${entityType} cover image for: "${title}"...`);
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

    if (!res.ok) {
      console.log(`    ❌ Image generation API failed: ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p: any) => p.inlineData?.data);

    if (imagePart?.inlineData?.data) {
      const mime = imagePart.inlineData.mimeType || "image/png";
      const ext = mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : "png";
      const fileKey = `curriculum/${slugify(entityType)}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const buf = Buffer.from(imagePart.inlineData.data, "base64");
      await r2.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: fileKey,
          Body: buf,
          ContentType: mime,
        })
      );

      const url = `${bucketUrl.replace(/\/$/, "")}/${fileKey}`;
      console.log(`    ✅ Image uploaded: ${url}`);
      return url;
    } else {
      console.log("    ❌ Image API returned no image payload");
      return null;
    }
  } catch (e) {
    console.error("    ❌ Failed to generate/upload image:", e);
    return null;
  }
}

// Post creator helper
async function createPost(args: {
  content_type: string;
  slug: string;
  title: string;
  content: string | null;
  jlpt_level: string;
  status: "published" | "draft";
  meta: Record<string, any>;
  tags?: string[];
  sort_order?: number;
}): Promise<string> {
  const rows = await sql`
    INSERT INTO posts (content_type, slug, title, content, summary, jlpt_level, tags, og_image_url, image_prompt, status, published_at, sort_order, meta)
    VALUES (
      ${args.content_type},
      ${args.slug},
      ${args.title},
      ${args.content},
      ${args.meta.summary || null},
      ${args.jlpt_level ? [args.jlpt_level] : []},
      ${args.tags ?? []},
      ${args.meta.feature_image_url || null},
      ${args.meta.image_prompt || null},
      ${args.status},
      ${args.status === "published" ? new Date().toISOString() : null},
      ${args.sort_order ?? 0},
      ${JSON.stringify(args.meta)}::jsonb
    )
    ON CONFLICT (slug) DO UPDATE SET
      title = EXCLUDED.title,
      content = EXCLUDED.content,
      meta = EXCLUDED.meta,
      updated_at = NOW()
    RETURNING id
  `;
  return (rows as { id: string }[])[0].id;
}

// Generate vocabulary items and link them
async function generateVocabulary(levelCode: string, lessonId: string, lessonTitle: string) {
  const existing = await sql`SELECT COUNT(*)::int AS c FROM curriculum_lesson_vocabulary WHERE lesson_id = ${lessonId}`;
  if ((existing as { c: number }[])[0].c > 0) return;

  console.log("    📝 Generating vocabulary items...");
  try {
    const sys = "You are a Japanese educator. Output ONLY a valid JSON array of 5 vocabulary items representing the lesson. Format: [{\"word\":\"...\",\"reading\":\"...\",\"meaning\":\"...\"}].";
    const user = `Lesson: "${lessonTitle}". Level: ${levelCode}. Provide 5 relevant vocabulary words.`;
    const res = await callGemini(sys, user, 1500);
    const list = JSON.parse(stripFences(res));

    let sort = 10;
    for (const item of list) {
      const word = String(item.word || "").trim();
      const reading = String(item.reading || "").trim();
      const meaning = String(item.meaning || "").trim();
      if (!word || !meaning) continue;

      const slug = slugify(`${levelCode}-vocab-${word}-${Math.abs(hashCode(word + meaning)).toString(36).slice(0, 4)}`);
      const postId = await createPost({
        content_type: "vocabulary",
        slug,
        title: word,
        content: null,
        jlpt_level: levelCode,
        status: "published",
        meta: { word, reading, meaning, summary: `${word} (${reading}) — ${meaning}` },
        tags: [levelCode, "vocabulary"],
      });

      const [v] = await sql`
        INSERT INTO vocabulary (post_id, word, reading, meaning, updated_at)
        VALUES (${postId}, ${word}, ${reading}, ${meaning}, NOW())
        ON CONFLICT (post_id) DO UPDATE SET word = EXCLUDED.word, reading = EXCLUDED.reading, meaning = EXCLUDED.meaning, updated_at = NOW()
        RETURNING id
      ` as { id: string }[];

      await sql`
        INSERT INTO curriculum_lesson_vocabulary (lesson_id, vocabulary_id, sort_order)
        VALUES (${lessonId}, ${v.id}, ${sort})
        ON CONFLICT DO NOTHING
      `;
      sort += 10;
    }
  } catch (e) {
    console.error("    ❌ Failed to generate vocab:", e);
  }
}

// Generate grammar points and link them
async function generateGrammar(levelCode: string, lessonId: string, lessonTitle: string) {
  const existing = await sql`SELECT COUNT(*)::int AS c FROM curriculum_lesson_grammar WHERE lesson_id = ${lessonId}`;
  if ((existing as { c: number }[])[0].c > 0) return;

  console.log("    📖 Generating grammar points...");
  try {
    const sys = "You are a Japanese grammar professor. Output ONLY a JSON array of 3 grammar patterns. Format: [{\"pattern\":\"...\",\"structure\":\"...\",\"meaning\":\"...\"}].";
    const user = `Lesson: "${lessonTitle}". Level: ${levelCode}. Provide 3 relevant grammar patterns.`;
    const res = await callGemini(sys, user, 1500);
    const list = JSON.parse(stripFences(res));

    let sort = 10;
    for (const item of list) {
      const pattern = String(item.pattern || "").trim();
      const structure = String(item.structure || "").trim();
      const meaning = String(item.meaning || "").trim();
      if (!pattern || !meaning) continue;

      const slug = slugify(`${levelCode}-grammar-${pattern}-${Math.abs(hashCode(pattern + meaning)).toString(36).slice(0, 4)}`);
      const postId = await createPost({
        content_type: "grammar",
        slug,
        title: pattern,
        content: null,
        jlpt_level: levelCode,
        status: "published",
        meta: { pattern, structure, meaning },
        tags: [levelCode, "grammar"],
      });

      const [g] = await sql`
        INSERT INTO grammar (post_id, pattern, structure, level, updated_at)
        VALUES (${postId}, ${pattern}, ${structure}, ${levelCode}, NOW())
        ON CONFLICT (post_id) DO UPDATE SET pattern = EXCLUDED.pattern, structure = EXCLUDED.structure, updated_at = NOW()
        RETURNING id
      ` as { id: string }[];

      await sql`
        INSERT INTO curriculum_lesson_grammar (lesson_id, grammar_id, sort_order)
        VALUES (${lessonId}, ${g.id}, ${sort})
        ON CONFLICT DO NOTHING
      `;
      sort += 10;
    }
  } catch (e) {
    console.error("    ❌ Failed to generate grammar:", e);
  }
}

// Generate kanji and link them
async function generateKanji(levelCode: string, lessonId: string, lessonTitle: string) {
  // Only generate kanji if the lesson/module title mentions "Kanji"
  if (!lessonTitle.toLowerCase().includes("kanji")) return;

  const existing = await sql`SELECT COUNT(*)::int AS c FROM curriculum_lesson_kanji WHERE lesson_id = ${lessonId}`;
  if ((existing as { c: number }[])[0].c > 0) return;

  console.log("    漢 Generating kanji entries...");
  try {
    const sys = "You are a Japanese kanji teacher. Output ONLY a JSON array of 3 kanji items. Format: [{\"character\":\"...\",\"meaning\":\"...\",\"onyomi\":[\"...\"],\"kunyomi\":[\"\n\"]}].";
    const user = `Lesson: "${lessonTitle}". Level: ${levelCode}. Provide 3 relevant kanji characters.`;
    const res = await callGemini(sys, user, 1500);
    const list = JSON.parse(stripFences(res));

    let sort = 10;
    for (const item of list) {
      const character = String(item.character || "").trim();
      const meaning = String(item.meaning || "").trim();
      const onyomi = Array.isArray(item.onyomi) ? item.onyomi : [];
      const kunyomi = Array.isArray(item.kunyomi) ? item.kunyomi : [];
      if (!character || !meaning) continue;

      const slug = slugify(`${levelCode}-kanji-${character}-${Math.abs(hashCode(character + meaning)).toString(36).slice(0, 4)}`);
      const postId = await createPost({
        content_type: "kanji",
        slug,
        title: character,
        content: null,
        jlpt_level: levelCode,
        status: "published",
        meta: { character, meaning, onyomi, kunyomi },
        tags: [levelCode, "kanji"],
      });

      const [k] = await sql`
        INSERT INTO kanji (post_id, character, onyomi, kunyomi, meaning, updated_at)
        VALUES (${postId}, ${character}, ${onyomi}, ${kunyomi}, ${meaning}, NOW())
        ON CONFLICT (post_id) DO UPDATE SET character = EXCLUDED.character, meaning = EXCLUDED.meaning, updated_at = NOW()
        RETURNING id
      ` as { id: string }[];

      await sql`
        INSERT INTO curriculum_lesson_kanji (lesson_id, kanji_id, sort_order)
        VALUES (${lessonId}, ${k.id}, ${sort})
        ON CONFLICT DO NOTHING
      `;
      sort += 10;
    }
  } catch (e) {
    console.error("    ❌ Failed to generate kanji:", e);
  }
}

// Generate example sentences
async function generateExamples(levelCode: string, lessonId: string, lessonTitle: string) {
  const existing = await sql`SELECT COUNT(*)::int AS c FROM examples WHERE lesson_id = ${lessonId}`;
  if ((existing as { c: number }[])[0].c > 0) return;

  console.log("    🗣 Generating example sentences...");
  try {
    const sys = "You are a Japanese translator. Output ONLY a JSON array of 3 example sentences representing the lesson topics. Format: [{\"sentence_ja\":\"...\",\"sentence_romaji\":\"...\",\"sentence_en\":\"...\"}].";
    const user = `Lesson: "${lessonTitle}". Level: ${levelCode}. Produce 3 sentence examples.`;
    const res = await callGemini(sys, user, 1500);
    const list = JSON.parse(stripFences(res));

    let sort = 10;
    for (const item of list) {
      const sentence_ja = String(item.sentence_ja || "").trim();
      const sentence_romaji = String(item.sentence_romaji || "").trim();
      const sentence_en = String(item.sentence_en || "").trim();
      if (!sentence_ja || !sentence_en) continue;

      await sql`
        INSERT INTO examples (lesson_id, sentence_ja, sentence_romaji, sentence_en, sort_order)
        VALUES (${lessonId}, ${sentence_ja}, ${sentence_romaji}, ${sentence_en}, ${sort})
        ON CONFLICT DO NOTHING
      `;
      sort += 10;
    }
  } catch (e) {
    console.error("    ❌ Failed to generate examples:", e);
  }
}

// Main processing worker
async function processLevel(levelCode: string, force: boolean, limit: number) {
  console.log(`\n🚀 Processing Content Generation for: ${levelCode} (limit: ${limit})`);
  
  // Select lessons from level
  const lessons = await sql`
    SELECT l.id, l.title, l.goal, l.introduction, l.feature_image_url
    FROM curriculum_lessons l
    JOIN curriculum_submodules sm ON sm.id = l.submodule_id
    JOIN curriculum_modules m ON m.id = sm.module_id
    JOIN curriculum_levels lv ON lv.id = m.level_id
    WHERE lv.code = ${levelCode}
    ORDER BY m.sort_order, sm.sort_order, l.sort_order
  ` as { id: string; title: string; goal: string | null; introduction: string | null; feature_image_url: string | null }[];

  console.log(`Found ${lessons.length} lessons in database.`);

  let count = 0;
  for (const les of lessons) {
    if (count >= limit) {
      console.log(`⏹ Limit of ${limit} lessons reached for level ${levelCode}.`);
      break;
    }

    console.log(`\n📖 Lesson: "${les.title}" (${les.id})`);

    // 1. Dynamic cover image generation (Anime vector style)
    if (!les.feature_image_url || force) {
      const imageUrl = await generateAndUploadImage(les.title, "lesson");
      if (imageUrl) {
        await sql`
          UPDATE curriculum_lessons
          SET feature_image_url = ${imageUrl}, updated_at = NOW()
          WHERE id = ${les.id}
        `;
      }
    } else {
      console.log("    🎨 Cover image already exists. Skipping.");
    }

    // 2. Generate Intro & Goal
    if (!les.goal || !les.introduction || force) {
      console.log("    🎯 Generating introduction and goal...");
      try {
        const sys = "You are an expert Japanese curriculum writer. Return ONLY a valid JSON object: {\"introduction\":\"...\", \"goal\":\"...\"}. Keep introduction around 100 words.";
        const user = `Lesson: "${les.title}". Level: ${levelCode}. Create a professional intro and goal.`;
        const res = await callGemini(sys, user, 1000);
        const data = JSON.parse(stripFences(res));
        await sql`
          UPDATE curriculum_lessons
          SET goal = ${data.goal || les.title},
              introduction = ${data.introduction || ""},
              updated_at = NOW()
          WHERE id = ${les.id}
        `;
      } catch (e) {
        console.error("    ❌ Failed to generate intro/goal:", e);
      }
    }

    // 3. Generate main lesson content posts
    const contentRows = await sql`
      SELECT content_role FROM curriculum_lesson_content WHERE lesson_id = ${les.id}
    ` as { content_role: string }[];
    
    if (contentRows.length === 0 || force) {
      console.log("    📚 Generating rich teaching markdown body and exercises...");
      try {
        const sysPrompt = "You are an elite Japanese language tutor. Write a comprehensive study guide in Markdown. Explain grammar rules, stroke order, or particles in detail. Provide examples and explanations. Output ONLY the clean Markdown text.";
        const userMessage = `Write a comprehensive, publication-grade Japanese lesson study guide on the topic: "${les.title}". Level: ${levelCode}. Keep it engaging, clear, and around 400-600 words.`;
        const mdBody = await callGemini(sysPrompt, userMessage, 3000);

        const baseSlug = `${levelCode.toLowerCase()}-${slugify(les.title)}`.slice(0, 60);
        const mainSlug = `${baseSlug}-main`;
        const exSlug = `${baseSlug}-ex`;

        const mainPostId = await createPost({
          content_type: "study_guide",
          slug: mainSlug,
          title: `${les.title} (Main Guide)`,
          content: mdBody,
          jlpt_level: levelCode,
          status: "published",
          meta: { summary: `Complete study guide for: ${les.title}` },
          tags: [levelCode, "lesson"],
        });

        const exPostId = await createPost({
          content_type: "study_guide",
          slug: exSlug,
          title: `${les.title} (Exercises)`,
          content: `## Exercises for ${les.title}\n\nReview the grammar and vocabulary, and try to fill in the blanks or write sentences based on the prompts.`,
          jlpt_level: levelCode,
          status: "published",
          meta: { summary: `Exercises for: ${les.title}` },
          tags: [levelCode, "exercise"],
        });

        await sql`DELETE FROM curriculum_lesson_content WHERE lesson_id = ${les.id}`;
        await sql`
          INSERT INTO curriculum_lesson_content (lesson_id, content_slug, post_id, content_role, sort_order)
          VALUES
            (${les.id}, ${mainSlug}, ${mainPostId}, 'main', 0),
            (${les.id}, ${exSlug}, ${exPostId}, 'exercise', 10)
        `;
      } catch (e) {
        console.error("    ❌ Failed to generate lesson content:", e);
      }
    }

    // 4. Generate metadata lists
    await generateVocabulary(levelCode, les.id, les.title);
    await generateGrammar(levelCode, les.id, les.title);
    await generateKanji(levelCode, les.id, les.title);
    await generateExamples(levelCode, les.id, les.title);

    count++;
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const force = argv.includes("--force");
  const limitArgIdx = argv.indexOf("--limit");
  const limit = limitArgIdx !== -1 && argv[limitArgIdx + 1] ? parseInt(argv[limitArgIdx + 1], 10) : 5; // Default generate 5 lessons
  const levelArgIdx = argv.indexOf("--level");
  const level = levelArgIdx !== -1 && argv[levelArgIdx + 1] ? argv[levelArgIdx + 1].toUpperCase() : "N5";

  await processLevel(level, force, limit);
}

main().catch(console.error);
