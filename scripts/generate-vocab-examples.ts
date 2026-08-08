/**
 * Generate example sentences (sentence_ja/sentence_romaji/sentence_en) for vocabulary posts
 * that have none — the site's biggest content gap: 4,613 of 5,224 published vocab posts
 * (88%) render as word+reading+meaning only. Assembled from three existing patterns rather
 * than one ready pipeline:
 *   - AI call: direct DeepSeek (src/app/api/ai/curriculum/generate-examples/route.ts's proven
 *     live pattern), falling back to OpenRouter->DeepSeek (scripts/backfill-reading-quiz.ts's
 *     pattern) on failure. Gemini is NOT used — the project's Gemini key is confirmed dead.
 *   - Prompt/schema: sentence_ja/sentence_romaji/sentence_en, matching the `examples` table
 *     columns exactly (same shape as the generate-examples admin route).
 *   - Insert + idempotency: NOT EXISTS (SELECT 1 FROM examples WHERE vocabulary_id = ...),
 *     matching scripts/backfill-sidecar-examples.mjs.
 *
 * Two modes:
 *   - PILOT (default): does NOT touch the database. Prints a pre-flight cost estimate, calls
 *     the AI for a small stratified sample (spanning multiple JLPT levels), and writes the
 *     generated sentences to a markdown file for human review, plus actual token usage/cost.
 *   - APPLY (--apply=true): inserts into the `examples` table for real, idempotent, resumable
 *     in batches via --limit. This is the Session E "scaled run" capability — build it now,
 *     but do not invoke --apply until the pilot output has been reviewed and approved.
 *
 * Run:
 *   npx tsx scripts/generate-vocab-examples.ts                          # pilot, ~25 items across levels
 *   npx tsx scripts/generate-vocab-examples.ts --per-level=10           # pilot, 10 per level (50 total)
 *   npx tsx scripts/generate-vocab-examples.ts --apply=true --limit=200 # write, first 200 candidates
 *
 * Requires: DATABASE_URL, and DEEPSEEK_API_KEY and/or OPENROUTER_API_KEY in env/.env
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { writeFileSync } from "fs";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL required");
  process.exit(1);
}
const sql = neon(DATABASE_URL);

const deepseekKey = process.env.DEEPSEEK_API_KEY;
const openrouterKey = process.env.OPENROUTER_API_KEY;
if (!deepseekKey && !openrouterKey) {
  console.error("DEEPSEEK_API_KEY or OPENROUTER_API_KEY required");
  process.exit(1);
}

const LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;
const TARGET_EXAMPLES_PER_WORD = 6;
// DeepSeek pricing already established in src/lib/contentReview/jobRunner.ts — re-declared
// here since this script runs standalone and doesn't import from src/.
const PROMPT_COST_PER_TOKEN = 0.14 / 1_000_000;
const COMPLETION_COST_PER_TOKEN = 0.28 / 1_000_000;

function getArg(name: string): string | null {
  const argv = process.argv.slice(2);
  const idx = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (idx === -1) return null;
  const a = argv[idx];
  return a.includes("=") ? a.split("=").slice(1).join("=") : argv[idx + 1] ?? "true";
}

const apply = getArg("apply") === "true";
const perLevelArg = getArg("per-level");
const perLevel = perLevelArg ? Math.max(1, parseInt(perLevelArg, 10)) : 5;
const limitArg = getArg("limit");
const limit = limitArg ? Math.max(1, parseInt(limitArg, 10)) : null;

type Candidate = {
  post_id: string;
  vocabulary_id: string;
  word: string;
  reading: string | null;
  meaning: string;
  part_of_speech: string | null;
  level: string | null;
};

type GeneratedExample = { sentence_ja: string; sentence_romaji?: string; sentence_en: string };

const SYSTEM_PROMPT = `You are an expert Japanese-language teacher writing example sentences for a JLPT vocabulary dictionary. Given a Japanese word, its reading, and its English meaning, write natural, level-appropriate example sentences that actually use the target word and show it in different realistic contexts. Reply with ONLY a valid JSON array, no markdown, no extra text: [{"sentence_ja":"...","sentence_romaji":"...","sentence_en":"..."}]. Keep grammar and vocabulary at or below the given JLPT level (N5 is easiest, N1 is hardest). Every sentence_ja must contain the target word.`;

function buildUserPrompt(c: Candidate): string {
  const pos = c.part_of_speech ? `, ${c.part_of_speech}` : "";
  const reading = c.reading && c.reading !== c.word ? ` (${c.reading})` : "";
  return `Word: ${c.word}${reading} — "${c.meaning}"${pos}. JLPT level: ${c.level ?? "N3"}. Write ${TARGET_EXAMPLES_PER_WORD} example sentences using this word naturally.`;
}

function cleanJSONString(raw: string): string {
  let clean = raw.replace(/^```\w*\n?|\n?```$/g, "").trim();
  const first = clean.indexOf("[");
  const last = clean.lastIndexOf("]");
  if (first !== -1 && last > first) clean = clean.slice(first, last + 1);
  return clean.replace(/,\s*([\]}])/g, "$1").replace(/[""]/g, '"');
}

type Usage = { promptTokens: number; completionTokens: number };

async function callDeepSeekDirect(system: string, user: string): Promise<{ text: string; usage: Usage }> {
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${deepseekKey}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.6,
      max_tokens: 1200,
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek failed: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    usage: { promptTokens: data.usage?.prompt_tokens ?? 0, completionTokens: data.usage?.completion_tokens ?? 0 },
  };
}

async function callOpenRouterFallback(system: string, user: string): Promise<{ text: string; usage: Usage }> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openrouterKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "deepseek/deepseek-chat-v3-0324",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 1200,
      temperature: 0.6,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter failed: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    usage: { promptTokens: data.usage?.prompt_tokens ?? 0, completionTokens: data.usage?.completion_tokens ?? 0 },
  };
}

async function callLLM(system: string, user: string): Promise<{ text: string; usage: Usage }> {
  if (deepseekKey) {
    try {
      return await callDeepSeekDirect(system, user);
    } catch (e) {
      console.warn("  DeepSeek direct failed, falling back to OpenRouter:", (e as Error).message.slice(0, 150));
    }
  }
  if (openrouterKey) return callOpenRouterFallback(system, user);
  throw new Error("No LLM path available (DeepSeek failed and no OPENROUTER_API_KEY configured)");
}

function parseExamples(raw: string): GeneratedExample[] {
  const parsed = JSON.parse(cleanJSONString(raw));
  if (!Array.isArray(parsed)) throw new Error("expected a JSON array");
  return parsed.filter(
    (it): it is GeneratedExample =>
      it &&
      typeof it === "object" &&
      typeof it.sentence_ja === "string" &&
      it.sentence_ja.trim() &&
      typeof it.sentence_en === "string" &&
      it.sentence_en.trim()
  );
}

async function fetchCandidates(): Promise<Candidate[]> {
  // APPLY mode: flat query across all eligible candidates, optionally capped by --limit
  // (omitting --limit means "process the entire remaining backlog", not "use a default").
  if (apply) {
    return (await sql`
      SELECT p.id AS post_id, v.id AS vocabulary_id, v.word, v.reading, v.meaning, v.part_of_speech,
        COALESCE((p.jlpt_level)[1], v.jlpt_level) AS level
      FROM posts p JOIN vocabulary v ON v.post_id = p.id
      WHERE p.status = 'published' AND p.content_type = 'vocabulary'
        AND (p.meta->>'merged_into_post_id') IS NULL
        AND v.word IS NOT NULL AND v.meaning IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM examples e WHERE e.vocabulary_id = v.id)
      ORDER BY p.created_at
      ${limit ? sql`LIMIT ${limit}` : sql``}
    `) as unknown as Candidate[];
  }

  // PILOT mode: stratified sample, --per-level items from each JLPT level (default 5).
  const out: Candidate[] = [];
  for (const level of LEVELS) {
    const rows = (await sql`
      SELECT p.id AS post_id, v.id AS vocabulary_id, v.word, v.reading, v.meaning, v.part_of_speech,
        COALESCE((p.jlpt_level)[1], v.jlpt_level) AS level
      FROM posts p JOIN vocabulary v ON v.post_id = p.id
      WHERE p.status = 'published' AND p.content_type = 'vocabulary'
        AND (p.meta->>'merged_into_post_id') IS NULL
        AND v.word IS NOT NULL AND v.meaning IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM examples e WHERE e.vocabulary_id = v.id)
        AND COALESCE((p.jlpt_level)[1], v.jlpt_level) = ${level}
      ORDER BY p.created_at
      LIMIT ${perLevel}
    `) as unknown as Candidate[];
    out.push(...rows);
  }
  return out;
}

async function main() {
  const totalEligible = (
    (await sql`
      SELECT COUNT(*) AS n
      FROM posts p JOIN vocabulary v ON v.post_id = p.id
      WHERE p.status = 'published' AND p.content_type = 'vocabulary'
        AND (p.meta->>'merged_into_post_id') IS NULL
        AND v.word IS NOT NULL AND v.meaning IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM examples e WHERE e.vocabulary_id = v.id)
    `) as { n: string }[]
  )[0].n;

  console.log("Generate vocab example sentences");
  console.log("mode:", apply ? "APPLY (writing to examples table)" : "PILOT (no DB writes, output to file)");
  console.log(`Total eligible vocab posts with zero examples: ${totalEligible}`);
  console.log(`Target examples per word: ${TARGET_EXAMPLES_PER_WORD}`);

  const candidates = await fetchCandidates();
  console.log(`This run will process: ${candidates.length} item(s)`);

  // Pre-flight cost estimate (rough, ~4 chars/token heuristic) before any API calls.
  const estPromptChars = SYSTEM_PROMPT.length + 200; // system + a representative user message
  const estPromptTokens = Math.ceil(estPromptChars / 4);
  const estCompletionTokens = TARGET_EXAMPLES_PER_WORD * 45; // rough JSON-object-per-example estimate
  const estCostThisRun =
    candidates.length * (estPromptTokens * PROMPT_COST_PER_TOKEN + estCompletionTokens * COMPLETION_COST_PER_TOKEN);
  const estCostFullBacklog =
    Number(totalEligible) * (estPromptTokens * PROMPT_COST_PER_TOKEN + estCompletionTokens * COMPLETION_COST_PER_TOKEN);
  console.log(
    `Estimated cost for this run: ~$${estCostThisRun.toFixed(4)} (rough pre-flight estimate; actual usage measured below)`
  );
  console.log(`Estimated cost to clear the full ${totalEligible}-item backlog at this rate: ~$${estCostFullBacklog.toFixed(2)}`);

  if (candidates.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let succeeded = 0;
  let failed = 0;
  let totalInserted = 0;
  const pilotOutput: string[] = [`# Vocab example-sentence pilot — ${new Date().toISOString()}\n`];

  for (const c of candidates) {
    const label = `${c.word}${c.reading && c.reading !== c.word ? ` (${c.reading})` : ""} [${c.level ?? "?"}] — "${c.meaning}"`;
    console.log(`\n${label}`);
    try {
      const { text, usage } = await callLLM(SYSTEM_PROMPT, buildUserPrompt(c));
      totalPromptTokens += usage.promptTokens;
      totalCompletionTokens += usage.completionTokens;
      const examples = parseExamples(text);
      if (examples.length === 0) {
        console.warn("  no valid examples returned, skipping");
        failed++;
        continue;
      }
      succeeded++;
      examples.forEach((ex) => console.log(`  - ${ex.sentence_ja}${ex.sentence_romaji ? ` (${ex.sentence_romaji})` : ""} — ${ex.sentence_en}`));

      if (apply) {
        for (let i = 0; i < examples.length; i++) {
          const ex = examples[i];
          await sql`
            INSERT INTO examples (vocabulary_id, sentence_ja, sentence_romaji, sentence_en, sort_order)
            SELECT ${c.vocabulary_id}, ${ex.sentence_ja.trim()}, ${ex.sentence_romaji?.trim() || null}, ${ex.sentence_en.trim()}, ${i}
            WHERE NOT EXISTS (SELECT 1 FROM examples WHERE vocabulary_id = ${c.vocabulary_id})
          `;
        }
        totalInserted += examples.length;
      } else {
        pilotOutput.push(`## ${label}\n`);
        examples.forEach((ex) => {
          pilotOutput.push(`- **JA:** ${ex.sentence_ja}  \n  **Romaji:** ${ex.sentence_romaji ?? "—"}  \n  **EN:** ${ex.sentence_en}`);
        });
        pilotOutput.push("");
      }
    } catch (e) {
      console.error("  FAILED:", (e as Error).message.slice(0, 200));
      failed++;
    }

    const done = succeeded + failed;
    if (apply && done % 100 === 0) {
      const runningCost = totalPromptTokens * PROMPT_COST_PER_TOKEN + totalCompletionTokens * COMPLETION_COST_PER_TOKEN;
      console.log(
        `\nPROGRESS: ${done}/${candidates.length} processed (succeeded: ${succeeded}, failed: ${failed}, cost so far: $${runningCost.toFixed(4)}, inserted: ${totalInserted})\n`
      );
    }
  }

  const actualCost = totalPromptTokens * PROMPT_COST_PER_TOKEN + totalCompletionTokens * COMPLETION_COST_PER_TOKEN;
  console.log("\n=== Summary ===");
  console.log(`Succeeded: ${succeeded}, Failed/skipped: ${failed}`);
  console.log(`Actual tokens used: ${totalPromptTokens} prompt + ${totalCompletionTokens} completion`);
  console.log(`Actual cost this run: $${actualCost.toFixed(4)}`);
  if (succeeded > 0) {
    const perItemCost = actualCost / succeeded;
    console.log(`Actual cost per item: $${perItemCost.toFixed(5)}`);
    console.log(`Projected cost for full ${totalEligible}-item backlog at this measured rate: ~$${(perItemCost * Number(totalEligible)).toFixed(2)}`);
  }

  if (apply) {
    console.log(`Inserted ${totalInserted} example row(s) into the examples table.`);
  } else {
    const outDir = process.env.PILOT_OUTPUT_DIR || "/tmp";
    const outPath = `${outDir}/vocab-examples-pilot-${Date.now()}.md`;
    writeFileSync(outPath, pilotOutput.join("\n"), "utf8");
    console.log(`\nPilot output written to: ${outPath}`);
    console.log("No database writes were made. Review the output, then re-run with --apply=true to write.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
