/**
 * Shared JLPT mock-test content generation library — used by both the CLI script
 * (scripts/generate-jlpt-mock-tests.ts, tight synchronous loop, no timeout concern) and the
 * admin "Generate with AI" modal (one step per HTTP round trip via
 * /api/admin/practice-tests/generate/[jobId]/step, since a full test's ~16 LLM calls + TTS
 * fetches would exceed a serverless function's request timeout if done in one shot).
 *
 * Structural modeling notes (deliberate, not schema limitations worked around blindly):
 * - practice_test_sections has ONE section_type + ONE shared passage/audio_url per row. Real
 *   JLPT reading has multiple distinct passages and listening has multiple distinct audio
 *   clips, so this generates ONE section PER reading passage / PER listening item-type group
 *   rather than forcing multiple passages into one section. Vocabulary/Grammar stay as one
 *   section each (no shared passage needed, except text_grammar's single cloze passage).
 * - Every level gets independently-timed Vocabulary/Grammar/Reading-section(s)/Listening-
 *   section(s) — the schema has no combined-timer concept. Each section's time_limit_minutes
 *   is the level's official *combined* figure (JLPT_TIMING, sourced from
 *   scripts/verify-jlpt-facts.ts) split proportionally by question count.
 * - Listening audio always uses per-QUESTION audio_url (never section-level).
 */
import { sql } from "@/lib/db";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { itemTypesForSection, type ItemTypeDef, type JlptLevel } from "@/lib/practiceTest/itemTypes";

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
const geminiKey = process.env.GEMINI_API_KEY;

// ---------- LLM helpers ----------
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
        // thinkingBudget: 0 disables gemini-2.5-flash's extended-thinking mode — without this,
        // internal reasoning tokens consume the whole maxOutputTokens budget before any visible
        // JSON is emitted, silently truncating every response.
        generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: 0 } },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini LLM call failed: ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

let useGeminiForText = true;
async function callDeepSeek(systemPrompt: string, userMessage: string, maxTokens: number): Promise<string> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY is not configured.");
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek LLM call failed: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callTextLLM(systemPrompt: string, userMessage: string, maxTokens: number): Promise<string> {
  if (useGeminiForText && geminiKey) {
    try {
      return await callGemini(systemPrompt, userMessage, maxTokens);
    } catch (e) {
      const msg = (e as Error).message || "";
      if (msg.includes("depleted") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("UNAUTHENTICATED") || msg.includes("401") || msg.includes("429")) {
        useGeminiForText = false;
      }
    }
  }
  return await callDeepSeek(systemPrompt, userMessage, maxTokens);
}

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
  clean = clean.replace(/[""]/g, '"');
  clean = clean.replace(/['']/g, "'");
  return clean;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Retries on parse failure or a caller-rejected shape (e.g. wrong top-level JSON key) — a
 * fresh generation is far more likely to succeed than any regex-level repair. */
async function callTextLLMForJSON<T>(sys: string, user: string, maxTokens: number, validate: (parsed: T) => void, retries = 2): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const raw = await callTextLLM(sys, user, maxTokens);
      const parsed = JSON.parse(cleanJSONString(raw)) as T;
      validate(parsed);
      return parsed;
    } catch (e) {
      lastError = e as Error;
      if (attempt < retries) await sleep(600);
    }
  }
  throw lastError ?? new Error("LLM JSON generation failed");
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

// ---------- TTS ----------
async function ttsChunk(text: string): Promise<Buffer | null> {
  try {
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ja&client=tw-ob&q=${encodeURIComponent(text)}`;
    const res = await fetch(ttsUrl, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" } });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function splitIntoTTSChunks(text: string, maxLen = 200): string[] {
  const sentences = text.split(/(?<=[。！？])/).filter((s) => s.trim());
  const chunks: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + s).length > maxLen && cur) {
      chunks.push(cur);
      cur = s;
    } else {
      cur += s;
    }
  }
  if (cur) chunks.push(cur);
  return chunks.length > 0 ? chunks : [text.slice(0, maxLen)];
}

async function generateTTSAndUpload(text: string, keyPrefix: string): Promise<string | null> {
  if (!bucketName || !bucketUrl) return null;
  try {
    const chunks = splitIntoTTSChunks(text);
    const buffers: Buffer[] = [];
    for (const chunk of chunks) {
      const buf = await ttsChunk(chunk);
      if (!buf) throw new Error(`TTS fetch failed for chunk: "${chunk.slice(0, 30)}..."`);
      buffers.push(buf);
      await sleep(150);
    }
    const combined = Buffer.concat(buffers);
    const fileKey = `practice-tests/audio-${keyPrefix}-${Date.now()}.mp3`;
    await r2.send(new PutObjectCommand({ Bucket: bucketName, Key: fileKey, Body: combined, ContentType: "audio/mpeg" }));
    return `${bucketUrl.replace(/\/$/, "")}/${fileKey}`;
  } catch {
    return null;
  }
}

// ---------- Official timing (source: scripts/verify-jlpt-facts.ts) ----------
export const JLPT_TIMING: Record<JlptLevel, { combinedMinutes: number; listeningMinutes: number; passingPercent: number }> = {
  N5: { combinedMinutes: 60, listeningMinutes: 30, passingPercent: 44 },
  N4: { combinedMinutes: 80, listeningMinutes: 35, passingPercent: 50 },
  N3: { combinedMinutes: 100, listeningMinutes: 40, passingPercent: 54 },
  N2: { combinedMinutes: 105, listeningMinutes: 50, passingPercent: 50 },
  N1: { combinedMinutes: 110, listeningMinutes: 55, passingPercent: 56 },
};

// ---------- Shapes ----------
export type GeneratedQuestion = { question_text: string; options: string[]; correct_index: number; explanation: string };
type StandaloneGroupResult = { questions: GeneratedQuestion[] };
type PassageGroupResult = { passage: string; questions: GeneratedQuestion[] };
type ListeningGroupResult = { items: { transcript: string; question: GeneratedQuestion }[] };

export function validateGeneratedQuestion(q: GeneratedQuestion): string[] {
  const errors: string[] = [];
  if (!q.question_text?.trim()) errors.push("empty question_text");
  if (!Array.isArray(q.options) || q.options.length < 2) errors.push("options must have >=2 items");
  if (typeof q.correct_index !== "number" || q.correct_index < 0 || q.correct_index >= (q.options?.length ?? 0)) {
    errors.push("correct_index out of range");
  }
  return errors;
}

const PLATFORM_NOTE = "This is platform-designed practice content in the style of the JLPT — not real/official JLPT exam questions.";
const JSON_HYGIENE_NOTE =
  "Output raw JSON only — no markdown code fences, no comments, no trailing commas. Every string value must be a single line with no literal line breaks (use spaces instead) and no unescaped double-quote characters inside it.";

// ---------- Content generators (one LLM call each — the unit of work for one job step) ----------
async function generateStandaloneGroup(level: JlptLevel, def: ItemTypeDef, count: number): Promise<StandaloneGroupResult> {
  const sys = `You are a JLPT (${level}) Japanese test item writer. ${PLATFORM_NOTE} Output ONLY a valid JSON object: {"questions":[{"question_text":"...","options":["...","...","...","..."],"correct_index":0,"explanation":"..."}]}. Each question has exactly 4 options, natural distractors (plausible but wrong), correct_index 0-based, explanation in English (1 sentence). ${JSON_HYGIENE_NOTE}`;
  const user = `Item type: ${def.label}. Instructions: ${def.groupInstructions}. Generate exactly ${count} questions at ${level} difficulty.`;
  return callTextLLMForJSON<StandaloneGroupResult>(sys, user, 2000, (parsed) => {
    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) throw new Error(`missing "questions" array for ${def.value}`);
  });
}

async function generatePassageGroup(level: JlptLevel, def: ItemTypeDef, count: number): Promise<PassageGroupResult> {
  const isCloze = def.value === "text_grammar";
  const sys = `You are a JLPT (${level}) Japanese reading-item writer. ${PLATFORM_NOTE} Output ONLY a valid JSON object: {"passage":"...","questions":[{"question_text":"...","options":["...","...","...","..."],"correct_index":0,"explanation":"..."}]}. The passage is natural Japanese at ${level} level, ${isCloze ? "with numbered blanks like （１）（２） for a cloze grammar exercise" : "appropriate length for the item type"}. Each question has exactly 4 options, correct_index 0-based, explanation in English. Within the "passage" string, use \\n for line breaks between sentences/paragraphs (a real JSON escape sequence, not a literal newline). ${JSON_HYGIENE_NOTE}`;
  const user = `Item type: ${def.label}. Instructions: ${def.groupInstructions}. Write one passage and exactly ${count} question(s) about it, at ${level} difficulty.`;
  return callTextLLMForJSON<PassageGroupResult>(sys, user, 2500, (parsed) => {
    if (!parsed.passage?.trim() || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      throw new Error(`missing "passage" or "questions" for ${def.value}`);
    }
  });
}

async function generateListeningGroup(level: JlptLevel, def: ItemTypeDef, count: number): Promise<ListeningGroupResult> {
  const sys = `You are a JLPT (${level}) Japanese listening-item writer. ${PLATFORM_NOTE}

The top-level JSON key MUST be "items", never "questions". Every item MUST include a non-empty "transcript" — this is the Japanese audio script that will be converted to speech; the question is answered purely by listening to it, so a question with no transcript is useless. Even for a single-utterance item type, "transcript" holds that utterance's Japanese text.

Output ONLY this exact JSON shape, with no other top-level keys:
{"items":[{"transcript":"（Japanese audio script）","question":{"question_text":"...","options":["...","...","...","..."],"correct_index":0,"explanation":"..."}}]}

Each transcript is natural Japanese appropriate for the item type at ${level} level (1-5 sentences depending on the item type). Each question has exactly 4 options, correct_index 0-based, explanation in English. ${JSON_HYGIENE_NOTE}`;
  const user = `Item type: ${def.label}. Instructions: ${def.groupInstructions}. Generate exactly ${count} independent transcript+question item(s) at ${level} difficulty. Remember: top-level key is "items", and every item has a "transcript".`;
  return callTextLLMForJSON<ListeningGroupResult>(sys, user, 2500, (parsed) => {
    if (!Array.isArray(parsed.items) || parsed.items.length === 0 || parsed.items.some((it) => !it.transcript?.trim())) {
      throw new Error(`missing "items" array or empty transcript for ${def.value}`);
    }
  });
}

// ---------- Step plan ----------
export type JobStepKind = "vocabulary" | "grammar" | "reading" | "listening";
export type JobStep = { kind: JobStepKind; itemType: string; label: string; count: number } | { kind: "finalize" };

const DEFAULT_COUNT: Record<"full" | "mini", Partial<Record<JobStepKind, number>>> = {
  full: { vocabulary: 3, grammar: 3, reading: 2, listening: 2 },
  mini: { vocabulary: 1, grammar: 1, reading: 1, listening: 1 },
};

/** Builds the ordered list of generation steps for a test — one step per item-type group, plus
 * a trailing "finalize" step that performs the DB write. `countOverrides` lets a caller (the
 * admin modal) override the default per-family question count; text_grammar is always capped
 * to 1 group regardless (real JLPT only ever has one cloze passage too). */
export function buildStepPlan(level: JlptLevel, variant: "full" | "mini", countOverrides?: Partial<Record<JobStepKind, number>>): JobStep[] {
  const steps: JobStep[] = [];
  const families: JobStepKind[] = ["vocabulary", "grammar", "reading", "listening"];
  for (const family of families) {
    const defaultCount = countOverrides?.[family] ?? DEFAULT_COUNT[variant][family] ?? 1;
    for (const def of itemTypesForSection(family, level)) {
      steps.push({ kind: family, itemType: def.value, label: def.label, count: def.value === "text_grammar" ? 1 : defaultCount });
    }
  }
  steps.push({ kind: "finalize" });
  return steps;
}

// ---------- Job state (persisted between steps — each step is one HTTP round trip) ----------
export type SectionInsert = {
  title: string;
  section_type: "vocabulary" | "grammar" | "reading" | "listening";
  passage: string | null;
  questions: (GeneratedQuestion & { item_type: string; audio_url: string | null })[];
};

export type JobState = {
  level: JlptLevel;
  variant: "full" | "mini";
  slug: string;
  title: string;
  targetPostId: string | null;
  sections: SectionInsert[];
  grammarPassage: string | null;
  audioFiles: number;
};

export function initJobState(level: JlptLevel, variant: "full" | "mini", slug: string, title: string, targetPostId: string | null): JobState {
  return { level, variant, slug, title, targetPostId, sections: [], grammarPassage: null, audioFiles: 0 };
}

function findOrCreateSection(state: JobState, sectionType: SectionInsert["section_type"], title: string, passage: string | null): SectionInsert {
  let section = state.sections.find((s) => s.section_type === sectionType && s.title === title);
  if (!section) {
    section = { title, section_type: sectionType, passage, questions: [] };
    state.sections.push(section);
  } else if (passage) {
    section.passage = passage;
  }
  return section;
}

/** Executes exactly one step, mutating `state` in place. Returns a short human-readable log
 * line for the caller to surface in a progress UI. Throws on failure (caller decides retry). */
export async function runStep(state: JobState, step: JobStep): Promise<string> {
  if (step.kind === "finalize") {
    return "finalize"; // callers handle the actual DB write via finalizeNewTest/finalizeAppendToPost
  }

  const def = itemTypesForSection(step.kind, state.level).find((t) => t.value === step.itemType);
  if (!def) throw new Error(`Unknown item type ${step.itemType} for ${step.kind}`);

  if (step.kind === "vocabulary") {
    const { questions } = await generateStandaloneGroup(state.level, def, step.count);
    const section = findOrCreateSection(state, "vocabulary", "Vocabulary", null);
    for (const q of questions) section.questions.push({ ...q, item_type: def.value, audio_url: null });
    return `Vocabulary — ${def.label} x${step.count}`;
  }

  if (step.kind === "grammar") {
    const section = findOrCreateSection(state, "grammar", "Grammar", null);
    if (def.value === "text_grammar") {
      const { passage, questions } = await generatePassageGroup(state.level, def, step.count);
      section.passage = passage;
      for (const q of questions) section.questions.push({ ...q, item_type: def.value, audio_url: null });
    } else {
      const { questions } = await generateStandaloneGroup(state.level, def, step.count);
      for (const q of questions) section.questions.push({ ...q, item_type: def.value, audio_url: null });
    }
    return `Grammar — ${def.label} x${step.count}`;
  }

  if (step.kind === "reading") {
    const { passage, questions } = await generatePassageGroup(state.level, def, step.count);
    state.sections.push({
      title: `Reading — ${def.label.replace(/\s*\(.*\)$/, "")}`,
      section_type: "reading",
      passage,
      questions: questions.map((q) => ({ ...q, item_type: def.value, audio_url: null })),
    });
    return `Reading — ${def.label} x${step.count}`;
  }

  // listening
  const { items } = await generateListeningGroup(state.level, def, step.count);
  const questions: SectionInsert["questions"] = [];
  for (const item of items) {
    const audioUrl = await generateTTSAndUpload(item.transcript, `${state.slug}-${def.value}-${questions.length + 1}`);
    if (audioUrl) state.audioFiles += 1;
    questions.push({ ...item.question, item_type: def.value, audio_url: audioUrl });
  }
  state.sections.push({ title: `Listening — ${def.label.replace(/\s*\(.*\)$/, "")}`, section_type: "listening", passage: null, questions });
  return `Listening — ${def.label} x${step.count} (${items.filter((i) => i).length} clip(s))`;
}

function validateAllQuestions(sections: SectionInsert[]): string[] {
  const errors: string[] = [];
  for (const section of sections) {
    for (const q of section.questions) {
      const qErrors = validateGeneratedQuestion(q);
      if (qErrors.length > 0) errors.push(`${section.title}: ${qErrors.join(", ")} — "${q.question_text.slice(0, 40)}"`);
    }
  }
  return errors;
}

/** Creates a brand-new practice_test post + all sections/questions from scratch. */
export async function finalizeNewTest(state: JobState): Promise<{ postId: string; totalQuestions: number; durationMinutes: number }> {
  if (!sql) throw new Error("Database unavailable");
  const errors = validateAllQuestions(state.sections);
  if (errors.length > 0) throw new Error(`Validation failed:\n${errors.join("\n")}`);

  const variantTimingScale = state.variant === "mini" ? 0.4 : 1;
  const timingBase = JLPT_TIMING[state.level];
  const timing = {
    combinedMinutes: Math.round(timingBase.combinedMinutes * variantTimingScale),
    listeningMinutes: Math.round(timingBase.listeningMinutes * variantTimingScale),
    passingPercent: timingBase.passingPercent,
  };

  const postRows = (await sql`
    INSERT INTO posts (content_type, slug, title, status, jlpt_level, tags, meta)
    VALUES ('practice_test', ${state.slug}, ${state.title}, 'draft', ${[state.level]}, ${[state.level, "practice_test", state.variant]}, ${JSON.stringify({ generatedBy: "generate-jlpt-mock-tests" })}::jsonb)
    RETURNING id
  `) as { id: string }[];
  const postId = postRows[0].id;

  const instructions =
    state.variant === "full"
      ? "The real JLPT times Vocabulary, Grammar, and Reading as one combined block; this simulation times them separately for focused practice, with total time matching the official combined figure."
      : "A shorter mini mock for quick practice — fewer questions per section and a reduced time budget than a full-length simulation.";

  try {
    const testRows = (await sql`
      INSERT INTO practice_tests (post_id, duration_minutes, passing_score_percent, instructions, test_variant, attempt_policy)
      VALUES (${postId}, 0, ${timing.passingPercent}, ${instructions}, ${state.variant}, 'unlimited')
      RETURNING id
    `) as { id: string }[];
    const practiceTestId = testRows[0].id;

    const { totalQuestions, sumMinutes } = await insertSections(practiceTestId, state, timing);
    await sql`UPDATE practice_tests SET duration_minutes = ${sumMinutes} WHERE id = ${practiceTestId}`;

    return { postId, totalQuestions, durationMinutes: sumMinutes };
  } catch (e) {
    // Post row (and any practice_tests/sections/questions inserted before the failure) would
    // otherwise linger as a broken partial draft — clean up rather than leave that for manual
    // discovery, since callers only see this function's thrown error, not the postId it created.
    await deletePost(postId);
    throw e;
  }
}

/** Appends generated sections to an EXISTING practice_test post (the "generate more" flow from
 * inside PracticeTestBuilder.tsx) — inserts sections/questions only, does not touch the post or
 * the practice_tests row's own settings, but does bump duration_minutes by the added time. */
export async function finalizeAppendToPost(state: JobState): Promise<{ totalQuestions: number; durationMinutes: number }> {
  if (!sql) throw new Error("Database unavailable");
  if (!state.targetPostId) throw new Error("finalizeAppendToPost requires targetPostId");
  const errors = validateAllQuestions(state.sections);
  if (errors.length > 0) throw new Error(`Validation failed:\n${errors.join("\n")}`);

  const testRows = (await sql`SELECT id FROM practice_tests WHERE post_id = ${state.targetPostId} LIMIT 1`) as { id: string }[];
  if (!testRows[0]) throw new Error("Target post has no practice_tests row — save the post's settings once first");
  const practiceTestId = testRows[0].id;

  const existingMaxSort = (await sql`
    SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM practice_test_sections WHERE practice_test_id = ${practiceTestId}
  `) as { max_sort: number }[];
  const sortOrder = (existingMaxSort[0]?.max_sort ?? 0) + 10;

  const variantTimingScale = state.variant === "mini" ? 0.4 : 1;
  const timingBase = JLPT_TIMING[state.level];
  const timing = {
    combinedMinutes: Math.round(timingBase.combinedMinutes * variantTimingScale),
    listeningMinutes: Math.round(timingBase.listeningMinutes * variantTimingScale),
  };

  const { totalQuestions, sumMinutes } = await insertSections(practiceTestId, state, timing, sortOrder);
  await sql`UPDATE practice_tests SET duration_minutes = duration_minutes + ${sumMinutes} WHERE id = ${practiceTestId}`;

  return { totalQuestions, durationMinutes: sumMinutes };
}

async function insertSections(
  practiceTestId: string,
  state: JobState,
  timing: { combinedMinutes: number; listeningMinutes: number },
  startSortOrder = 10
): Promise<{ totalQuestions: number; sumMinutes: number }> {
  if (!sql) throw new Error("Database unavailable");
  const combinedFamilies = state.sections.filter((s) => s.section_type !== "listening");
  const listeningFamilies = state.sections.filter((s) => s.section_type === "listening");
  const combinedTotalQ = combinedFamilies.reduce((sum, s) => sum + s.questions.length, 0) || 1;
  const listeningTotalQ = listeningFamilies.reduce((sum, s) => sum + s.questions.length, 0) || 1;

  let totalQuestions = 0;
  let sumMinutes = 0;
  let sortOrder = startSortOrder;

  for (const section of state.sections) {
    const familyMinutes = section.section_type === "listening" ? timing.listeningMinutes : timing.combinedMinutes;
    const familyTotalQ = section.section_type === "listening" ? listeningTotalQ : combinedTotalQ;
    const timeLimitMinutes = Math.max(3, Math.round((section.questions.length / familyTotalQ) * familyMinutes));
    sumMinutes += timeLimitMinutes;

    const sectionRows = (await sql`
      INSERT INTO practice_test_sections (practice_test_id, title, section_type, time_limit_minutes, passage, sort_order)
      VALUES (${practiceTestId}, ${section.title}, ${section.section_type}, ${timeLimitMinutes}, ${section.passage}, ${sortOrder})
      RETURNING id
    `) as { id: string }[];
    const sectionId = sectionRows[0].id;
    sortOrder += 10;

    let qSortOrder = 10;
    for (const q of section.questions) {
      await sql`
        INSERT INTO practice_test_questions (section_id, question_text, item_type, options, correct_index, explanation, audio_url, sort_order)
        VALUES (${sectionId}, ${q.question_text}, ${q.item_type}, ${JSON.stringify(q.options)}::jsonb, ${q.correct_index}, ${q.explanation}, ${q.audio_url}, ${qSortOrder})
      `;
      qSortOrder += 10;
      totalQuestions += 1;
    }
  }

  return { totalQuestions, sumMinutes };
}

export async function deletePost(postId: string) {
  if (!sql) return;
  await sql`DELETE FROM posts WHERE id = ${postId}`; // cascades through practice_tests/sections/questions
}

export async function alreadyHasContent(slug: string): Promise<boolean> {
  if (!sql) return false;
  const rows = (await sql`
    SELECT COUNT(pq.id)::int AS q_count
    FROM posts p
    JOIN practice_tests pt ON pt.post_id = p.id
    LEFT JOIN practice_test_sections ps ON ps.practice_test_id = pt.id
    LEFT JOIN practice_test_questions pq ON pq.section_id = ps.id
    WHERE p.slug = ${slug}
    GROUP BY p.id
  `) as { q_count: number }[];
  return (rows[0]?.q_count ?? 0) > 0;
}
