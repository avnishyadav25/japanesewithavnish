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

// Helper: Clean JSON string
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
  // Remove trailing commas inside arrays and objects
  clean = clean.replace(/,\s*([\]}])/g, "$1");
  // Normalize double quotes
  clean = clean.replace(/[\u201C\u201D]/g, '"');
  // Normalize single quotes
  clean = clean.replace(/[\u2018\u2019]/g, "'");
  return clean;
}

// Helper: Generate TTS Audio and upload to R2
async function generateTTSAndUpload(text: string, slug: string): Promise<string | null> {
  if (!bucketName || !bucketUrl) {
    console.log("    ⚠️ Skipping TTS audio generation (R2 configs missing)");
    return null;
  }
  try {
    // Call public Google Translate TTS endpoint (high-quality native Japanese voice)
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ja&client=tw-ob&q=${encodeURIComponent(text.slice(0, 200))}`;
    const res = await fetch(ttsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });
    if (!res.ok) throw new Error("TTS fetch failed");

    const arrayBuffer = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    const fileKey = `listening/audio-${slug}-${Date.now()}.mp3`;

    await r2.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: fileKey,
        Body: buf,
        ContentType: "audio/mpeg",
      })
    );

    const url = `${bucketUrl.replace(/\/$/, "")}/${fileKey}`;
    console.log(`    🔊 Audio generated and uploaded: ${url}`);
    return url;
  } catch (e) {
    console.error("    ❌ Failed to generate TTS audio:", e);
    return null;
  }
}

// Helper: Create/Insert dynamic Post
async function createPost(args: {
  content_type: string;
  slug: string;
  title: string;
  content: string | null;
  jlpt_level: string;
  status: "published" | "draft";
  meta: Record<string, any>;
  tags?: string[];
}): Promise<string> {
  const rows = await sql`
    INSERT INTO posts (content_type, slug, title, content, summary, jlpt_level, tags, og_image_url, status, published_at, meta)
    VALUES (
      ${args.content_type},
      ${args.slug},
      ${args.title},
      ${args.content},
      ${args.meta.summary || null},
      ${args.jlpt_level ? [args.jlpt_level] : []},
      ${args.tags ?? []},
      ${args.meta.feature_image_url || null},
      ${args.status},
      NOW(),
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

// 1. Generate Grammar points
async function generateGrammarData(levelCode: string) {
  console.log(`\n📖 [Grammar] Generating items for level: ${levelCode}...`);
  try {
    const sys = "You are a Japanese educator. Output ONLY a valid JSON array of 3 grammar patterns. Format: [{\"pattern\":\"...\",\"structure\":\"...\",\"meaning\":\"...\",\"explanation\":\"...\"}]. Strictly double quotes, no comments, no thought blocks.";
    const user = `Level: ${levelCode}. Provide 3 relevant grammar patterns.`;
    const res = await callGemini(sys, user, 1500);
    const list = JSON.parse(cleanJSONString(res));

    for (const item of list) {
      const pattern = String(item.pattern || "").trim();
      const structure = String(item.structure || "").trim();
      const meaning = String(item.meaning || "").trim();
      const explanation = String(item.explanation || "").trim();
      if (!pattern || !meaning) continue;

      const slug = slugify(`${levelCode}-grammar-${pattern}-${Math.random().toString(36).slice(2, 6)}`);
      const postId = await createPost({
        content_type: "grammar",
        slug,
        title: pattern,
        content: `## Grammar Pattern: ${pattern}\n\n**Structure:** ${structure}\n\n**Meaning:** ${meaning}\n\n**Explanation:**\n${explanation}`,
        jlpt_level: levelCode,
        status: "published",
        meta: { pattern, structure, meaning, summary: `Learn how to use ${pattern} (${meaning})` },
        tags: [levelCode, "grammar"],
      });

      await sql`
        INSERT INTO grammar (post_id, pattern, structure, level, notes, updated_at)
        VALUES (${postId}, ${pattern}, ${structure}, ${levelCode}, ${meaning}, NOW())
        ON CONFLICT (post_id) DO UPDATE SET pattern = EXCLUDED.pattern, structure = EXCLUDED.structure, updated_at = NOW()
      `;
      console.log(`   ✅ Inserted Grammar Pattern: ${pattern}`);
    }
  } catch (e) {
    console.error("   ❌ Failed to generate grammar:", e);
  }
}

// 2. Generate Vocabulary terms
async function generateVocabData(levelCode: string) {
  console.log(`\n📝 [Vocabulary] Generating items for level: ${levelCode}...`);
  try {
    const sys = "You are a Japanese educator. Output ONLY a valid JSON array of 5 vocabulary items. Format: [{\"word\":\"...\",\"reading\":\"...\",\"meaning\":\"...\",\"notes\":\"...\"}]. Strictly double quotes, no comments, no thought blocks.";
    const user = `Level: ${levelCode}. Provide 5 relevant vocabulary words.`;
    const res = await callGemini(sys, user, 1500);
    const list = JSON.parse(cleanJSONString(res));

    for (const item of list) {
      const word = String(item.word || "").trim();
      const reading = String(item.reading || "").trim();
      const meaning = String(item.meaning || "").trim();
      const notes = String(item.notes || "").trim();
      if (!word || !meaning) continue;

      const slug = slugify(`${levelCode}-vocab-${word}-${Math.random().toString(36).slice(2, 6)}`);
      const postId = await createPost({
        content_type: "vocabulary",
        slug,
        title: word,
        content: `## Vocabulary: ${word}\n\n**Reading:** ${reading}\n\n**Meaning:** ${meaning}\n\n**Usage Notes:**\n${notes}`,
        jlpt_level: levelCode,
        status: "published",
        meta: { word, reading, meaning, summary: `${word} (${reading}) — ${meaning}` },
        tags: [levelCode, "vocabulary"],
      });

      await sql`
        INSERT INTO vocabulary (post_id, word, reading, meaning, notes, updated_at)
        VALUES (${postId}, ${word}, ${reading}, ${meaning}, ${notes}, NOW())
        ON CONFLICT (post_id) DO UPDATE SET word = EXCLUDED.word, reading = EXCLUDED.reading, meaning = EXCLUDED.meaning, updated_at = NOW()
      `;
      console.log(`   ✅ Inserted Vocabulary: ${word}`);
    }
  } catch (e) {
    console.error("   ❌ Failed to generate vocabulary:", e);
  }
}

// 3. Generate Kanji characters
async function generateKanjiData(levelCode: string) {
  console.log(`\n漢 [Kanji] Generating items for level: ${levelCode}...`);
  try {
    const sys = "You are a Japanese kanji teacher. Output ONLY a valid JSON array of 3 kanji characters. Format: [{\"character\":\"...\",\"meaning\":\"...\",\"onyomi\":[\"...\"],\"kunyomi\":[\"...\"],\"stroke_count\":5}]. Strictly double quotes, no comments, no thought blocks.";
    const user = `Level: ${levelCode}. Provide 3 relevant kanji.`;
    const res = await callGemini(sys, user, 1500);
    const list = JSON.parse(cleanJSONString(res));

    for (const item of list) {
      const character = String(item.character || "").trim();
      const meaning = String(item.meaning || "").trim();
      const onyomi = Array.isArray(item.onyomi) ? item.onyomi : [];
      const kunyomi = Array.isArray(item.kunyomi) ? item.kunyomi : [];
      const strokeCount = parseInt(item.stroke_count, 10) || 5;
      if (!character || !meaning) continue;

      const slug = slugify(`${levelCode}-kanji-${character}-${Math.random().toString(36).slice(2, 6)}`);
      const postId = await createPost({
        content_type: "kanji",
        slug,
        title: character,
        content: `## Kanji character: ${character}\n\n**Meaning:** ${meaning}\n\n**Onyomi:** ${onyomi.join(", ")}\n\n**Kunyomi:** ${kunyomi.join(", ")}`,
        jlpt_level: levelCode,
        status: "published",
        meta: { character, meaning, onyomi, kunyomi, strokeCount },
        tags: [levelCode, "kanji"],
      });

      await sql`
        INSERT INTO kanji (post_id, character, onyomi, kunyomi, meaning, stroke_count, updated_at)
        VALUES (${postId}, ${character}, ${onyomi}, ${kunyomi}, ${meaning}, ${strokeCount}, NOW())
        ON CONFLICT (post_id) DO UPDATE SET character = EXCLUDED.character, meaning = EXCLUDED.meaning, updated_at = NOW()
      `;
      console.log(`   ✅ Inserted Kanji: ${character}`);
    }
  } catch (e) {
    console.error("   ❌ Failed to generate kanji:", e);
  }
}

// 4. Generate Reading lessons
async function generateReadingData(levelCode: string) {
  console.log(`\n📖 [Reading] Generating items for level: ${levelCode}...`);
  try {
    const sys = "You are a Japanese teacher. Output ONLY a valid JSON object representing a reading story passage. Format: {\"title\":\"...\",\"content\":\"(Japanese short story)\",\"glossary\":[{\"text\":\"...\",\"definition\":\"...\"}]}. Keep story under 150 characters. Strictly double quotes, no thought blocks.";
    const user = `Level: ${levelCode}. Provide a short reading passage with glossary items.`;
    const res = await callGemini(sys, user, 2000);
    const data = JSON.parse(cleanJSONString(res));

    const title = String(data.title || "Short Reading Story").trim();
    const content = String(data.content || "").trim();
    if (!content) return;

    const slug = slugify(`${levelCode}-reading-${title.slice(0, 20)}-${Math.random().toString(36).slice(2, 6)}`);
    const postId = await createPost({
      content_type: "reading",
      slug,
      title,
      content,
      jlpt_level: levelCode,
      status: "published",
      meta: { summary: `Comprehension reading: ${title}` },
      tags: [levelCode, "reading"],
    });

    // Clear and build glossary items
    await sql`DELETE FROM reading_glossary WHERE post_id = ${postId}`;
    const glossary = Array.isArray(data.glossary) ? data.glossary : [];
    
    for (const g of glossary) {
      const gText = String(g.text || "").trim();
      const gDef = String(g.definition || "").trim();
      if (!gText || !gDef) continue;

      const startIdx = content.indexOf(gText);
      if (startIdx === -1) continue;
      const endIdx = startIdx + gText.length;

      await sql`
        INSERT INTO reading_glossary (post_id, segment_text, segment_start, segment_end, definition_text)
        VALUES (${postId}, ${gText}, ${startIdx}, ${endIdx}, ${gDef})
      `;
    }
    console.log(`   ✅ Inserted Reading Story: ${title}`);
  } catch (e) {
    console.error("   ❌ Failed to generate reading story:", e);
  }
}

// 5. Generate Listening lessons
async function generateListeningData(levelCode: string) {
  console.log(`\n🔊 [Listening] Generating items for level: ${levelCode}...`);
  try {
    const sys = "You are a Japanese educator. Output ONLY a valid JSON object representing a listening dialog. Format: {\"title\":\"...\",\"transcript\":\"...\",\"dialog_jp\":\"...\",\"questions\":[{\"text\":\"...\",\"options\":[\"...\",\"...\",\"...\"],\"correct\":0}]}. Keep transcript short under 100 characters. Strictly double quotes, no thought blocks.";
    const user = `Level: ${levelCode}. Create a listening dialogue scenario.`;
    const res = await callGemini(sys, user, 2000);
    const data = JSON.parse(cleanJSONString(res));

    const title = String(data.title || "Listening Practice").trim();
    const transcript = String(data.transcript || data.dialog_jp || "").trim();
    if (!transcript) return;

    // 1. Generate R2 Audio URL
    const slug = slugify(`${levelCode}-listening-${title.slice(0, 20)}-${Math.random().toString(36).slice(2, 6)}`);
    const audioUrl = await generateTTSAndUpload(transcript, slug);

    // 2. Create parent post
    const postId = await createPost({
      content_type: "listening",
      slug,
      title,
      content: `## Listening Practice: ${title}\n\nListen to the dialogue and answer the comprehension questions.`,
      jlpt_level: levelCode,
      status: "published",
      meta: { summary: `Listening scenario: ${title}`, audioUrl },
      tags: [levelCode, "listening"],
    });

    // 3. Create listening table record
    const [listening] = await sql`
      INSERT INTO listening (post_id, title, audio_url, notes, updated_at)
      VALUES (${postId}, ${title}, ${audioUrl}, 'Audio-based JLPT scenario practice.', NOW())
      ON CONFLICT (post_id) DO UPDATE SET title = EXCLUDED.title, audio_url = EXCLUDED.audio_url, updated_at = NOW()
      RETURNING id
    ` as { id: string }[];

    // 4. Create scenario item
    const [scenario] = await sql`
      INSERT INTO listening_scenarios (listening_id, title, audio_url, transcript, sort_order)
      VALUES (${listening.id}, ${title}, ${audioUrl}, ${transcript}, 10)
      RETURNING id
    ` as { id: string }[];

    // 5. Insert questions
    const questions = Array.isArray(data.questions) ? data.questions : [];
    let qSort = 10;
    for (const q of questions) {
      const qText = String(q.text || "").trim();
      const qOptions = Array.isArray(q.options) ? q.options : [];
      const qCorrect = parseInt(q.correct, 10) || 0;
      if (!qText || qOptions.length === 0) continue;

      await sql`
        INSERT INTO listening_questions (scenario_id, question_text, options, correct_index, sort_order)
        VALUES (${scenario.id}, ${qText}, ${JSON.stringify(qOptions)}::jsonb, ${qCorrect}, ${qSort})
      `;
      qSort += 10;
    }
    console.log(`   ✅ Inserted Listening Dialogue: ${title}`);
  } catch (e) {
    console.error("   ❌ Failed to generate listening scenario:", e);
  }
}

// Main execution populator loop
async function run() {
  const levels = ["N5", "N4", "N3", "N2", "N1"];
  console.log("🚀 Starting database populating content generator...");

  for (const lvl of levels) {
    console.log(`\n========================================`);
    console.log(`📚 POPULATING JLPT LEVEL: ${lvl}`);
    console.log(`========================================`);
    
    await generateGrammarData(lvl);
    await generateVocabData(lvl);
    await generateKanjiData(lvl);
    await generateReadingData(lvl);
    await generateListeningData(lvl);
  }

  console.log("\n🎉 Population finished successfully!");
  process.exit(0);
}

run().catch(console.error);
