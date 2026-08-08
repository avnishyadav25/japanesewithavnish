/**
 * Fix a real duplicate-content bug: 206 of 560 published grammar posts (37%) share the exact
 * same "How To Use It" paragraph verbatim, regardless of the actual grammar pattern —
 * "Focus on the connection pattern first, then make one sentence about your own life. Check
 * particles carefully before memorizing." This replaces that boilerplate with unique,
 * pattern-specific guidance, and adds a new "Common Mistakes" section (matching the site-wide
 * intent to deepen grammar pages), using the same DeepSeek-direct/OpenRouter-fallback scaffold
 * as scripts/generate-vocab-examples.ts.
 *
 * Idempotent: the WHERE clause only matches posts still containing the boilerplate string, so
 * once replaced a post naturally drops out of the candidate pool on re-run.
 *
 * Two modes:
 *   - PILOT (default): no DB writes. Prints a cost estimate, generates for a small sample
 *     spanning multiple JLPT levels, writes output to a markdown file for review.
 *   - APPLY (--apply=true): replaces the boilerplate in posts.content for real.
 *
 * Run:
 *   npx tsx scripts/deepen-grammar-explanations.ts                    # pilot, ~25 across levels
 *   npx tsx scripts/deepen-grammar-explanations.ts --apply=true       # write, full backlog
 *   npx tsx scripts/deepen-grammar-explanations.ts --apply=true --limit=100
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

const BOILERPLATE =
  "Focus on the connection pattern first, then make one sentence about your own life. Check particles carefully before memorizing.";
const LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;
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
const limitArg = getArg("limit");
const limit = limitArg ? Math.max(1, parseInt(limitArg, 10)) : null;
const perLevelArg = getArg("per-level");
const perLevel = perLevelArg ? Math.max(1, parseInt(perLevelArg, 10)) : 5;

type Candidate = {
  post_id: string;
  title: string;
  content: string;
  pattern: string;
  meaning: string | null;
  structure: string | null;
  level: string | null;
};

type Generated = { how_to_use: string; common_mistake: string };

const SYSTEM_PROMPT = `You are an expert Japanese-language teacher writing content for a JLPT grammar reference site. Given a grammar pattern, its meaning, structure, and JLPT level, write (1) a specific, practical "how to use it" explanation (2-3 sentences, English, that explains THIS pattern's actual usage and nuance — never generic advice that could apply to any pattern) and (2) one common mistake learners make specifically with this pattern (1-2 sentences). Reply with ONLY valid JSON, no markdown: {"how_to_use":"...","common_mistake":"..."}`;

function buildUserPrompt(c: Candidate): string {
  return `Pattern: ${c.pattern}. Meaning: "${c.meaning ?? "unknown"}". Structure: ${c.structure ?? "unknown"}. JLPT level: ${c.level ?? "N3"}.`;
}

function cleanJSONString(raw: string): string {
  let clean = raw.replace(/^```\w*\n?|\n?```$/g, "").trim();
  const first = clean.indexOf("{");
  const last = clean.lastIndexOf("}");
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
      max_tokens: 400,
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
      max_tokens: 400,
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
  throw new Error("No LLM path available");
}

function parseGenerated(raw: string): Generated | null {
  const parsed = JSON.parse(cleanJSONString(raw));
  if (
    parsed &&
    typeof parsed.how_to_use === "string" &&
    parsed.how_to_use.trim() &&
    typeof parsed.common_mistake === "string" &&
    parsed.common_mistake.trim()
  ) {
    return { how_to_use: parsed.how_to_use.trim(), common_mistake: parsed.common_mistake.trim() };
  }
  return null;
}

async function fetchCandidates(): Promise<Candidate[]> {
  if (apply) {
    return (await sql`
      SELECT p.id AS post_id, p.title, p.content, g.pattern, g.meaning, g.structure,
        COALESCE((p.jlpt_level)[1], g.level) AS level
      FROM posts p JOIN grammar g ON g.post_id = p.id
      WHERE p.status = 'published' AND p.content ILIKE ${"%" + BOILERPLATE + "%"}
      ORDER BY p.created_at
      ${limit ? sql`LIMIT ${limit}` : sql``}
    `) as unknown as Candidate[];
  }

  const out: Candidate[] = [];
  for (const level of LEVELS) {
    const rows = (await sql`
      SELECT p.id AS post_id, p.title, p.content, g.pattern, g.meaning, g.structure,
        COALESCE((p.jlpt_level)[1], g.level) AS level
      FROM posts p JOIN grammar g ON g.post_id = p.id
      WHERE p.status = 'published' AND p.content ILIKE ${"%" + BOILERPLATE + "%"}
        AND COALESCE((p.jlpt_level)[1], g.level) = ${level}
      ORDER BY p.created_at
      LIMIT ${perLevel}
    `) as unknown as Candidate[];
    out.push(...rows);
  }
  return out;
}

async function main() {
  const totalEligible = (
    (await sql`SELECT COUNT(*) n FROM posts WHERE status = 'published' AND content ILIKE ${"%" + BOILERPLATE + "%"}`) as {
      n: string;
    }[]
  )[0].n;

  console.log("Deepen grammar explanations (fix duplicate boilerplate)");
  console.log("mode:", apply ? "APPLY (writing to posts.content)" : "PILOT (no DB writes, output to file)");
  console.log(`Total eligible (still has boilerplate): ${totalEligible}`);

  const candidates = await fetchCandidates();
  console.log(`This run will process: ${candidates.length} item(s)`);

  const estPromptTokens = Math.ceil((SYSTEM_PROMPT.length + 150) / 4);
  const estCompletionTokens = 90;
  const estCostThisRun =
    candidates.length * (estPromptTokens * PROMPT_COST_PER_TOKEN + estCompletionTokens * COMPLETION_COST_PER_TOKEN);
  console.log(`Estimated cost for this run: ~$${estCostThisRun.toFixed(4)} (rough pre-flight estimate)`);

  if (candidates.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let succeeded = 0;
  let failed = 0;
  const pilotOutput: string[] = [`# Grammar deepening pilot — ${new Date().toISOString()}\n`];

  for (const c of candidates) {
    const label = `${c.pattern} [${c.level ?? "?"}] — "${c.meaning ?? ""}"`;
    console.log(`\n${label}`);
    try {
      const { text, usage } = await callLLM(SYSTEM_PROMPT, buildUserPrompt(c));
      totalPromptTokens += usage.promptTokens;
      totalCompletionTokens += usage.completionTokens;
      const gen = parseGenerated(text);
      if (!gen) {
        console.warn("  no valid generation returned, skipping");
        failed++;
        continue;
      }
      succeeded++;
      console.log(`  How to use: ${gen.how_to_use}`);
      console.log(`  Common mistake: ${gen.common_mistake}`);

      const replacement = `## How To Use It\n${gen.how_to_use}\n\n## Common Mistakes\n${gen.common_mistake}`;
      const newContent = c.content.replace(`## How To Use It\n${BOILERPLATE}`, replacement);

      if (apply) {
        if (newContent === c.content) {
          console.warn("  WARNING: boilerplate text not found verbatim in content, skipping to avoid a no-op write");
          failed++;
          continue;
        }
        await sql`
          UPDATE posts SET content = ${newContent}, updated_at = NOW()
          WHERE id = ${c.post_id} AND content ILIKE ${"%" + BOILERPLATE + "%"}
        `;
      } else {
        pilotOutput.push(`## ${label}\n`);
        pilotOutput.push(`**How to use:** ${gen.how_to_use}\n`);
        pilotOutput.push(`**Common mistake:** ${gen.common_mistake}\n`);
      }
    } catch (e) {
      console.error("  FAILED:", (e as Error).message.slice(0, 200));
      failed++;
    }

    const done = succeeded + failed;
    if (apply && done % 50 === 0) {
      const runningCost = totalPromptTokens * PROMPT_COST_PER_TOKEN + totalCompletionTokens * COMPLETION_COST_PER_TOKEN;
      console.log(`\nPROGRESS: ${done}/${candidates.length} (succeeded: ${succeeded}, failed: ${failed}, cost so far: $${runningCost.toFixed(4)})\n`);
    }
  }

  const actualCost = totalPromptTokens * PROMPT_COST_PER_TOKEN + totalCompletionTokens * COMPLETION_COST_PER_TOKEN;
  console.log("\n=== Summary ===");
  console.log(`Succeeded: ${succeeded}, Failed/skipped: ${failed}`);
  console.log(`Actual cost this run: $${actualCost.toFixed(4)}`);

  if (!apply) {
    const outDir = process.env.PILOT_OUTPUT_DIR || "/tmp";
    const outPath = `${outDir}/grammar-deepening-pilot-${Date.now()}.md`;
    writeFileSync(outPath, pilotOutput.join("\n"), "utf8");
    console.log(`\nPilot output written to: ${outPath}`);
    console.log("No database writes were made. Review the output, then re-run with --apply=true to write.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
