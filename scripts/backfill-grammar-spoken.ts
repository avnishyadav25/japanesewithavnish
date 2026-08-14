/**
 * Backfills grammar.pattern_spoken and grammar.pattern_romaji.
 *
 *   npx tsx scripts/backfill-grammar-spoken.ts                 PILOT — writes nothing
 *   npx tsx scripts/backfill-grammar-spoken.ts --apply         write, resumable
 *   npx tsx scripts/backfill-grammar-spoken.ts --apply --limit=50
 *   npx tsx scripts/backfill-grammar-spoken.ts --structure     also normalise `structure`
 *
 * WHY
 *
 * 280 of 548 published grammar patterns are mixed notation — "Verb volitional form + と思います",
 * "Vて-form + ください". That is the correct way to WRITE a grammar point, and `pattern` keeps it.
 * But the Video Studio hands `pattern` to a Japanese TTS voice, which reads "Verb volitional
 * form" with Japanese phonetics and produces gibberish.
 *
 * storyboard.ts already has a runtime fallback that strips the Latin, but it is crude: it turns
 * "Vて-form + ください" into "て、ください" — the stray て comes from the Latin-Japanese hybrid token
 * "Vて-form". A model can see that the actual phrase is ください and that the て belongs to the
 * conjugation being described. That judgement is what this script is for.
 *
 * Follows the house PILOT/APPLY convention from scripts/generate-vocab-examples.ts: the default
 * run writes nothing, prints a cost estimate, and dumps a markdown sample to read before you
 * trust it.
 */
import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { neon } from "@neondatabase/serverless";

const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";
const MODEL = "deepseek-chat";
const PROMPT_COST_PER_TOKEN = 0.14 / 1_000_000;
const COMPLETION_COST_PER_TOKEN = 0.28 / 1_000_000;
/** Patterns per LLM call. Large enough to be cheap, small enough that one bad batch is cheap to
 * discard and re-run. */
const BATCH_SIZE = 20;
const PILOT_SAMPLE = 25;
const PILOT_OUTPUT_DIR = "./out/grammar-spoken-pilot";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
const sql = neon(process.env.DATABASE_URL);

function arg(name: string): string | undefined {
  const hit = process.argv.slice(2).find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  return hit.includes("=") ? hit.split("=").slice(1).join("=") : "true";
}

interface Row {
  id: string;
  pattern: string;
  meaning: string | null;
  structure: string | null;
  level: string | null;
}

interface Result {
  id: string;
  spoken: string;
  romaji: string;
  structure?: string;
}

const SYSTEM_PROMPT = `You decide what a Japanese grammar pattern should SOUND LIKE when read aloud.

Each pattern is written the way a textbook writes it: Japanese mixed with English scaffolding and
placeholder letters — "Verb volitional form + と思います", "A は B です", "Vて-form + ください".
A speech synthesiser cannot read the English, and naively stripping the placeholders leaves
particle soup that is worse than silence.

Decide which case each pattern is.

CASE 1 — the pattern contains a genuine, self-contained Japanese phrase.
  Return that phrase.
    "Verb volitional form + と思います"   -> spoken "と思います"
    "Vて-form + ください"                 -> spoken "ください"
        (the て belongs to the conjugation being described, not to the phrase)
    "N + ばかり"                          -> spoken "ばかり"
    "Direct Object Particle: を (o/wo)"  -> spoken "を"   (the particle IS the lesson)
    "〜たことがある"                       -> spoken "たことがある"

CASE 2 — the Japanese is only particles or fragments glued between placeholders, so removing the
placeholders leaves something no Japanese speaker would ever utter.
  Return an EMPTY STRING for both fields. All of these are case 2:
    "A は B です"                (would leave "はです" — meaningless)
    "AはB歳です"                 (would leave "は歳です")
    "Aは/が Bに 〜てあげる"       (would leave "はがにてあげる")
    "AとBです"                   (would leave "とです")
    "Katakana Noun + で + Verb"  (would leave a bare mid-sentence "で")
    "Verb volitional form (by itself)"  (no Japanese at all)

  Empty is CORRECT and expected. It means the video's narrator explains the pattern in English
  while the real example sentences carry the Japanese audio — far better than a voice reading
  "wa desu" aloud in a teaching video.

When in doubt choose CASE 2. A missing audio clip is invisible; a nonsense one is embarrassing.

Fields:
  spoken  — the Japanese to read aloud, or "" for case 2. Never a Latin letter, never a
            placeholder, never a notation symbol (+ ~ 〜 / [ ] ( )).
  romaji  — Hepburn of "spoken" (lowercase, macrons ō/ū), or "" when spoken is "".

Never invent, correct or extend the grammar. If a pattern is already pure natural Japanese,
"spoken" is that pattern unchanged.

Return ONLY a JSON array: [{"id":"...","spoken":"...","romaji":"..."}]. No markdown fence.`;

const STRUCTURE_INSTRUCTION = `
Additionally return "structure": a cleaned display form of the given structure string. Keep the
English scaffolding — this one is DISPLAYED, never spoken — but normalise spacing around +, use
consistent placeholder names (Verb, Noun, い-adj, な-adj), and fix obvious typos. If the structure
is already clean or absent, omit the field.`;

/** Takes the first of any alternatives and strips leftover notation, so nothing reaches the
 * voice that it would read as a symbol. */
function normaliseSpoken(text: string): string {
  return text
    .split(/[/／]/)[0]
    .replace(/[〜～~＋+()（）[\]]/g, "")
    .trim();
}

async function callModel(
  rows: Row[],
  includeStructure: boolean
): Promise<{ results: Result[]; promptTokens: number; completionTokens: number }> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY is not set");

  const userMessage = rows
    .map((r) =>
      JSON.stringify({
        id: r.id,
        pattern: r.pattern,
        meaning: r.meaning ?? undefined,
        structure: includeStructure ? r.structure ?? undefined : undefined,
        level: r.level ?? undefined,
      })
    )
    .join("\n");

  const res = await fetch(DEEPSEEK_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT + (includeStructure ? STRUCTURE_INSTRUCTION : "") },
        { role: "user", content: userMessage },
      ],
      temperature: 0,
      max_tokens: 4000,
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek failed: ${res.status} ${(await res.text()).slice(0, 200)}`);

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const raw = (data.choices?.[0]?.message?.content ?? "").replace(/^```\w*\n?|\n?```$/g, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Could not parse model output: ${raw.slice(0, 200)}`);
  }
  if (!Array.isArray(parsed)) throw new Error("Model did not return an array");

  const byId = new Map(rows.map((r) => [r.id, r]));
  const results: Result[] = [];
  for (const entry of parsed as Record<string, unknown>[]) {
    const id = typeof entry.id === "string" ? entry.id : "";
    if (!byId.has(id)) continue;
    const raw = typeof entry.spoken === "string" ? entry.spoken.trim() : "";
    // A "spoken" form containing Latin means the model ignored the one rule that matters.
    // Dropping the row is better than storing something that will be mispronounced — the
    // runtime fallback in storyboard.ts still handles it.
    if (/[A-Za-z]/.test(raw)) continue;
    // Alternative forms come back as "からだ / からです". A voice reads the slash aloud, so only
    // the first form is stored. (primaryReading() applies the same rule at runtime; storing it
    // clean means the admin sees what will actually be said.)
    const spoken = normaliseSpoken(raw);

    results.push({
      id,
      spoken,
      romaji: spoken ? normaliseSpoken(typeof entry.romaji === "string" ? entry.romaji.trim() : "") : "",
      structure: typeof entry.structure === "string" && entry.structure.trim() ? entry.structure.trim() : undefined,
    });
  }

  return {
    results,
    promptTokens: data.usage?.prompt_tokens ?? 0,
    completionTokens: data.usage?.completion_tokens ?? 0,
  };
}

async function main(): Promise<void> {
  const apply = arg("apply") === "true";
  const includeStructure = arg("structure") === "true";
  const limit = Number(arg("limit") ?? 0) || undefined;

  const pending = (await sql`
    SELECT g.id, g.pattern, g.meaning, g.structure, g.level
    FROM grammar g
    JOIN posts p ON p.id = g.post_id
    WHERE p.status = 'published' AND g.pattern_spoken IS NULL
    -- md5 rather than g.pattern: ordering alphabetically makes the pilot sample nothing but
    -- "A は B です" forms from the start of the list, which tells you nothing about how the run
    -- handles the N3/N4 patterns you actually care about. Deterministic so a re-run of the
    -- pilot samples the same rows and you can compare prompt edits fairly.
    ORDER BY md5(g.id::text)
  `) as Row[];

  const rows = limit ? pending.slice(0, limit) : pending;
  const mixed = rows.filter((r) => /[A-Za-z]/.test(r.pattern)).length;

  console.log(`\nGrammar spoken-form backfill`);
  console.log(`  pending          ${pending.length} published patterns without a spoken form`);
  console.log(`  this run         ${rows.length}`);
  console.log(`  mixed notation   ${mixed} (${((mixed / Math.max(1, rows.length)) * 100).toFixed(0)}% — the ones that break TTS today)`);
  console.log(`  structure pass   ${includeStructure ? "yes" : "no (pass --structure to include)"}`);

  if (rows.length === 0) {
    console.log("\nNothing to do.");
    return;
  }

  // Pre-flight cost estimate, before spending anything.
  const avgChars = rows.reduce((n, r) => n + r.pattern.length + (r.meaning?.length ?? 0), 0) / rows.length;
  const estTokens = (rows.length * (avgChars + 60)) / 4 + SYSTEM_PROMPT.length / 4;
  console.log(`  est. cost        ~$${(estTokens * PROMPT_COST_PER_TOKEN + estTokens * 0.6 * COMPLETION_COST_PER_TOKEN).toFixed(4)}`);

  const target = apply ? rows : rows.slice(0, PILOT_SAMPLE);
  if (!apply) {
    console.log(`\nPILOT — nothing will be written. Sampling ${target.length} rows.\n`);
  } else {
    console.log(`\nAPPLY — writing ${target.length} rows.\n`);
  }

  const all: (Result & { pattern: string })[] = [];
  let promptTokens = 0;
  let completionTokens = 0;

  for (let i = 0; i < target.length; i += BATCH_SIZE) {
    const batch = target.slice(i, i + BATCH_SIZE);
    process.stdout.write(`  batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(target.length / BATCH_SIZE)} (${batch.length}) ... `);
    try {
      const { results, promptTokens: pt, completionTokens: ct } = await callModel(batch, includeStructure);
      promptTokens += pt;
      completionTokens += ct;
      const byId = new Map(batch.map((r) => [r.id, r]));
      for (const r of results) all.push({ ...r, pattern: byId.get(r.id)!.pattern });
      console.log(`${results.length}/${batch.length} usable`);

      if (apply) {
        for (const r of results) {
          // Idempotent and resumable: only fills rows still NULL, so a re-run after a crash
          // never overwrites a form someone has since corrected by hand.
          await sql`
            UPDATE grammar
            SET pattern_spoken = ${r.spoken},
                pattern_romaji = ${r.romaji || null},
                structure = COALESCE(${r.structure ?? null}, structure)
            WHERE id = ${r.id}::uuid AND pattern_spoken IS NULL
          `;
        }
      }
    } catch (err) {
      console.log(`FAILED — ${err instanceof Error ? err.message : String(err)}`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  const cost = promptTokens * PROMPT_COST_PER_TOKEN + completionTokens * COMPLETION_COST_PER_TOKEN;
  console.log(`\n  actual cost      $${cost.toFixed(5)} (${promptTokens} prompt + ${completionTokens} completion tokens)`);

  if (!apply) {
    await fs.mkdir(PILOT_OUTPUT_DIR, { recursive: true });
    const file = path.join(PILOT_OUTPUT_DIR, "sample.md");
    const md = [
      "# Grammar spoken-form pilot",
      "",
      `${all.length} of ${target.length} sampled patterns produced a usable result.`,
      "",
      "| pattern (written, stays on screen) | spoken (sent to the voice) | romaji |",
      "|---|---|---|",
      ...all.map((r) => `| ${r.pattern} | ${r.spoken || "_(nothing spoken)_"} | ${r.romaji} |`),
      "",
      "Read the middle column aloud. If any row would sound wrong, fix the prompt in",
      "scripts/backfill-grammar-spoken.ts before running with --apply.",
    ].join("\n");
    await fs.writeFile(file, md, "utf8");
    console.log(`\n  Wrote ${file}`);
    console.log(`  Read it, then re-run with --apply.\n`);
  } else {
    const [{ done, total }] = (await sql`
      SELECT COUNT(pattern_spoken)::int AS done, COUNT(*)::int AS total
      FROM grammar g JOIN posts p ON p.id = g.post_id WHERE p.status = 'published'
    `) as { done: number; total: number }[];
    console.log(`\n  ${done}/${total} published patterns now have a spoken form.\n`);
  }
}

main().catch((err) => {
  console.error("\nBackfill failed:", err);
  process.exit(1);
});
