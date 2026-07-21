/**
 * Phase D (block-system rollout): converts each published `listening` post's
 * existing listening_scenarios/listening_questions rows into content_blocks
 * (one `audio` block + one `comprehension_question` block per question).
 *
 * Unlike Reading, the existing listening data is structurally sound (every
 * published post already has a scenario with real audio + transcript + 4
 * questions) — this is a straight structural copy, not a content-quality
 * rewrite. The one genuinely missing piece is `explanation` per question
 * (listening_questions has no such column) and `durationSeconds` (not
 * tracked anywhere) — both are required by the new mandatory Listening
 * publish gate (src/lib/blocks/publishGate.ts). This script drafts
 * explanations with AI (one batched call per post covering all its
 * questions, not one call per question) and leaves durationSeconds unset
 * for a human to fill in during review — audio duration isn't detectable
 * without downloading/parsing the file, which is out of scope here.
 *
 * Every migrated block lands status='draft', review_status='pending' — a
 * human must review and re-save through the admin block editor before a
 * listening post can pass the new publish gate. Idempotent: skips any post
 * that already has content_blocks rows.
 *
 * Usage:
 *   npx tsx scripts/migrate-listening-posts-to-blocks.ts             # dry run
 *   npx tsx scripts/migrate-listening-posts-to-blocks.ts --apply     # inserts for real
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { writeFileSync } from "fs";
import { join } from "path";
import { validateBlockData } from "../src/lib/blocks/blockTypes";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
const sql = neon(DATABASE_URL);

const APPLY = process.argv.includes("--apply");
const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";

type Question = { id: string; question_text: string; options: string[]; correct_index: number };

async function draftExplanations(
  transcript: string,
  questions: Question[]
): Promise<Record<string, string> | null> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  const systemPrompt = `You write brief explanations for Japanese-listening comprehension quiz answers. Given a transcript and a list of questions (each with options and the correct option), output ONLY valid JSON: {"explanations": {"<question index>": "explanation text", ...}}. Each explanation is 1-2 sentences, in English, explaining why the correct answer is right based on the transcript. Index questions from 0.`;
  const userMessage = JSON.stringify({
    transcript,
    questions: questions.map((q, i) => ({ index: i, question: q.question_text, options: q.options, correctAnswer: q.options[q.correct_index] })),
  });

  const res = await fetch(DEEPSEEK_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 1000,
      temperature: 0.5,
    }),
  });
  if (!res.ok) {
    console.error(`  DeepSeek error: ${res.status} ${await res.text().catch(() => "")}`);
    return null;
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content ?? "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as { explanations?: Record<string, string> };
    return parsed.explanations ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const posts = (await sql`
    SELECT p.id, p.slug, p.title, l.id AS listening_id
    FROM posts p JOIN listening l ON l.post_id = p.id
    WHERE p.content_type = 'listening' ORDER BY p.slug
  `) as { id: string; slug: string; title: string; listening_id: string }[];

  const alreadyMigrated = await sql`SELECT DISTINCT post_id FROM content_blocks`;
  const migratedIds = new Set((alreadyMigrated as { post_id: string }[]).map((r) => r.post_id));

  const report: {
    postId: string;
    slug: string;
    status: "planned" | "skipped_already_migrated" | "skipped_no_scenario" | "explanation_draft_failed";
    scenarioCount: number;
    questionCount: number;
    errors: string[];
  }[] = [];

  let audioInserted = 0;
  let questionsInserted = 0;

  for (const post of posts) {
    if (migratedIds.has(post.id)) {
      report.push({ postId: post.id, slug: post.slug, status: "skipped_already_migrated", scenarioCount: 0, questionCount: 0, errors: [] });
      continue;
    }

    const scenarios = (await sql`
      SELECT id, title, audio_url, transcript FROM listening_scenarios WHERE listening_id = ${post.listening_id} ORDER BY sort_order
    `) as { id: string; title: string; audio_url: string | null; transcript: string | null }[];

    if (scenarios.length === 0) {
      report.push({ postId: post.id, slug: post.slug, status: "skipped_no_scenario", scenarioCount: 0, questionCount: 0, errors: [] });
      continue;
    }

    const errors: string[] = [];
    let totalQuestions = 0;
    const plannedInserts: { blockType: "audio" | "comprehension_question"; data: Record<string, unknown> }[] = [];

    for (const scenario of scenarios) {
      const audioData: Record<string, unknown> = { audioUrl: scenario.audio_url ?? "" };
      if (scenario.transcript) audioData.transcript = scenario.transcript;
      const audioErrors = validateBlockData("audio", audioData);
      if (audioErrors.length > 0) errors.push(`audio (${scenario.title}): ${audioErrors.join(", ")}`);
      else plannedInserts.push({ blockType: "audio", data: audioData });

      const questions = (await sql`
        SELECT id, question_text, options, correct_index FROM listening_questions WHERE scenario_id = ${scenario.id} ORDER BY sort_order
      `) as Question[];
      totalQuestions += questions.length;

      let explanations: Record<string, string> | null = null;
      if (APPLY && questions.length > 0 && scenario.transcript) {
        explanations = await draftExplanations(scenario.transcript, questions);
      }

      questions.forEach((q, i) => {
        const choices = q.options.map((text, idx) => ({ text, isCorrect: idx === q.correct_index }));
        const qData: Record<string, unknown> = { question: q.question_text, choices, skill: "detail" };
        const explanation = explanations?.[String(i)];
        if (explanation) qData.explanation = explanation;
        const qErrors = validateBlockData("comprehension_question", qData);
        if (qErrors.length > 0) errors.push(`question "${q.question_text}": ${qErrors.join(", ")}`);
        else plannedInserts.push({ blockType: "comprehension_question", data: qData });
      });
    }

    report.push({ postId: post.id, slug: post.slug, status: "planned", scenarioCount: scenarios.length, questionCount: totalQuestions, errors });

    if (APPLY && errors.length === 0) {
      let sortOrder = 10;
      for (const b of plannedInserts) {
        await sql`
          INSERT INTO content_blocks (post_id, block_type, block_data, sort_order, status, review_status, generated_by_model)
          VALUES (${post.id}, ${b.blockType}, ${JSON.stringify(b.data)}::jsonb, ${sortOrder}, 'draft', 'pending', ${b.blockType === "comprehension_question" && b.data.explanation ? "deepseek-chat" : null})
        `;
        sortOrder += 10;
        if (b.blockType === "audio") audioInserted++;
        else questionsInserted++;
      }
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = join(__dirname, "backups", `listening-block-migration-${APPLY ? "apply" : "dry-run"}-${timestamp}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  const planned = report.filter((r) => r.status === "planned");
  const withErrors = planned.filter((r) => r.errors.length > 0);
  const skippedMigrated = report.filter((r) => r.status === "skipped_already_migrated").length;
  const skippedNoScenario = report.filter((r) => r.status === "skipped_no_scenario").length;

  console.log(`\nMode: ${APPLY ? "APPLY" : "DRY RUN"}`);
  console.log(`Posts total: ${posts.length}`);
  console.log(`Planned: ${planned.length}, with validation errors: ${withErrors.length}`);
  console.log(`Skipped (already migrated): ${skippedMigrated}, skipped (no scenario): ${skippedNoScenario}`);
  if (APPLY) console.log(`Audio blocks inserted: ${audioInserted}, question blocks inserted: ${questionsInserted}`);
  if (withErrors.length > 0) {
    console.log("\nPosts with validation errors (not applied even in --apply mode):");
    for (const r of withErrors) console.log(`  ${r.slug}: ${r.errors.join(" | ")}`);
  }
  console.log(`\nFull report: ${reportPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
