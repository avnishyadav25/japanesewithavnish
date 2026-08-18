/**
 * Fills the two measured example gaps, so a video scene never teaches a rule with no evidence.
 *
 * WHAT IS ACTUALLY MISSING, measured rather than assumed:
 *   vocabulary   5215 / 5215 have an example sentence — nothing to do. (A note of mine claiming
 *                88% were thin was out of date; something filled them.)
 *   grammar       366 / 548  have one — 182 missing.
 *   kanji         117 / 2185 have a SENTENCE, but that is the wrong measure: KanjiStrokeScene
 *                 shows example WORDS drawn from the vocabulary table, and 1541 / 2185 have at
 *                 least one. The 644 with neither are the real gap.
 *
 * So this backfills 182 grammar examples and 644 kanji examples, not 2,250. Generating sentences
 * for the 1,541 kanji that already have example words would be spending money to add a row nothing
 * renders.
 *
 * REVIEW. Generated Japanese nobody has checked goes live immediately — the row is inserted and
 * pages and videos use it — but the parent post is flipped to `needs_human_review`, so it surfaces
 * in the Content Review Center rather than sitting unmarked forever. That is the trade that was
 * chosen deliberately: invisible-but-unverified is worse than visible-and-flagged.
 *
 * Sequential, resumable (it re-queries what is still missing on every run), and it reports what it
 * skipped rather than silently capping.
 *
 * Usage:
 *   npx tsx scripts/backfill-examples.ts --dry-run          # generate 3, print, write nothing
 *   npx tsx scripts/backfill-examples.ts --kind=grammar --limit=5
 *   npx tsx scripts/backfill-examples.ts                    # everything still missing
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { callDeepSeekJson, deepSeekConfigured, parseJsonResponse } from "../src/lib/ai/deepseek";

config({ path: ".env.local" });
config({ path: ".env" });

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
const sql = neon(process.env.DATABASE_URL);

interface Target {
  kind: "grammar" | "kanji";
  id: string;
  postId: string;
  title: string;
  meaning: string;
  level: string | null;
  extra: string;
}

interface Generated {
  sentence_ja: string;
  sentence_romaji: string;
  sentence_en: string;
}

const SYSTEM = `You write example sentences for a Japanese learning site.

Rules, all of them hard requirements:
- The sentence MUST actually contain the target grammar pattern or kanji. This is the whole point.
- Keep it at or below the stated JLPT level. An N5 learner cannot read an N2 sentence.
- Natural, everyday Japanese. Not a textbook drill, not a proverb, not a pun.
- 8 to 18 characters of Japanese. Long enough to show usage, short enough to fit on a video card.
- sentence_romaji is Hepburn, spaced by word, no macrons.
- sentence_en is a natural English translation, not a gloss.

Reply with JSON only: {"sentence_ja": "...", "sentence_romaji": "...", "sentence_en": "..."}`;

async function grammarTargets(limit: number | null): Promise<Target[]> {
  const rows = (await sql`
    SELECT g.id, g.post_id, p.title, COALESCE(g.meaning, p.summary, '') AS meaning,
           (p.jlpt_level)[1] AS level, COALESCE(g.pattern, p.title) AS pattern,
           COALESCE(g.structure, '') AS structure
    FROM grammar g JOIN posts p ON p.id = g.post_id
    WHERE p.status = 'published'
      AND NOT EXISTS (SELECT 1 FROM examples e WHERE e.grammar_id = g.id)
    ORDER BY CASE (p.jlpt_level)[1]
               WHEN 'N5' THEN 1 WHEN 'N4' THEN 2 WHEN 'N3' THEN 3 WHEN 'N2' THEN 4 ELSE 5 END,
             p.title
    ${limit ? sql`LIMIT ${limit}` : sql``}
  `) as Record<string, string>[];
  return rows.map((r) => ({
    kind: "grammar" as const,
    id: r.id,
    postId: r.post_id,
    title: r.pattern,
    meaning: r.meaning,
    level: r.level ?? null,
    extra: r.structure ? `Structure: ${r.structure}` : "",
  }));
}

/**
 * Kanji with NO example sentence AND no vocabulary word containing the character.
 *
 * The second half of that condition is what keeps this from being a 2,068-row job: a kanji scene
 * with example words already shows real usage, so a generated sentence would add cost and change
 * nothing on screen.
 */
async function kanjiTargets(limit: number | null): Promise<Target[]> {
  const rows = (await sql`
    SELECT k.id, k.post_id, k.character, COALESCE(k.meaning, p.summary, '') AS meaning,
           (p.jlpt_level)[1] AS level,
           COALESCE(array_to_string(k.onyomi, '、'), '') AS onyomi,
           COALESCE(array_to_string(k.kunyomi, '、'), '') AS kunyomi
    FROM kanji k JOIN posts p ON p.id = k.post_id
    WHERE p.status = 'published' AND k.character IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM examples e WHERE e.kanji_id = k.id)
      AND NOT EXISTS (
        SELECT 1 FROM vocabulary v JOIN posts vp ON vp.id = v.post_id
        WHERE vp.status = 'published' AND v.word LIKE '%' || k.character || '%'
      )
    ORDER BY CASE (p.jlpt_level)[1]
               WHEN 'N5' THEN 1 WHEN 'N4' THEN 2 WHEN 'N3' THEN 3 WHEN 'N2' THEN 4 ELSE 5 END,
             k.character
    ${limit ? sql`LIMIT ${limit}` : sql``}
  `) as Record<string, string>[];
  return rows.map((r) => ({
    kind: "kanji" as const,
    id: r.id,
    postId: r.post_id,
    title: r.character,
    meaning: r.meaning,
    level: r.level ?? null,
    extra: [r.onyomi && `On: ${r.onyomi}`, r.kunyomi && `Kun: ${r.kunyomi}`].filter(Boolean).join("  "),
  }));
}

function userMessage(t: Target): string {
  return [
    t.kind === "grammar"
      ? `Write ONE example sentence using the grammar pattern: ${t.title}`
      : `Write ONE example sentence that contains the kanji ${t.title}`,
    `It means: ${t.meaning || "(no gloss available)"}`,
    t.extra,
    `Target level: ${t.level ?? "N5"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * The sentence must contain what it claims to demonstrate.
 *
 * Checked rather than trusted: a model asked for a sentence using a pattern will occasionally
 * return a sentence ABOUT the pattern, and for kanji it will substitute a commoner character for a
 * rare one. Both are useless on a card that highlights the target, and both are invisible unless
 * asserted — exactly the kind of thing that otherwise reaches hundreds of live pages.
 *
 * BUT A LITERAL SUBSTRING TEST IS WRONG FOR GRAMMAR, and the first version of this function was.
 * It rejected 23 items that were all correct, for two distinct reasons found by reading them:
 *
 *   1. CONJUGATION. `〜てくださる` is demonstrated by 「教えてくださいました」, which does not contain
 *      「てくださる」 anywhere. Patterns inflect; the citation form rarely survives into a sentence.
 *   2. THE "PATTERN" IS OFTEN A DESCRIPTION, not a string. 「い-adjective (past, negative)」 is a
 *      lesson heading — the only Japanese run in it is 「い」, and 「昨日は寒くなかったです。」 is a
 *      textbook-perfect example that happens not to contain that character at all. Likewise
 *      「Special case: いい → よい」 and 「やゆよ + small ゃゅょ」.
 *
 * So: descriptive headings skip the check entirely (review catches them, and they are flagged
 * either way), and literal patterns are matched on a PREFIX of their longest Japanese run, which
 * survives inflection because Japanese conjugates at the tail.
 *
 * Kanji stays exact. A character either appears or it does not, and substitution is a real failure.
 */
const JAPANESE_RUN = /[\u3040-\u30ff\u4e00-\u9fff]+/g;

/** A heading rather than a pattern: an arrow, a plus, a bracket, or Latin prose in the title. */
function isDescriptive(title: string): boolean {
  return /[→+()（）]|[A-Za-z]{3,}/.test(title);
}

function containsTarget(t: Target, ja: string): boolean {
  if (t.kind === "kanji") return ja.includes(t.title);
  if (isDescriptive(t.title)) return true;

  const runs = t.title.replace(/[〜~]/g, "").match(JAPANESE_RUN);
  if (!runs?.length) return true;
  const longest = runs.reduce((a, b) => (b.length > a.length ? b : a));
  // 60% of the citation form, floored at two characters. Long enough that an unrelated sentence
  // will not match by accident, short enough to survive the inflected tail.
  const prefix = longest.slice(0, Math.max(2, Math.ceil(longest.length * 0.6)));
  return ja.includes(prefix);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const kindArg = process.argv.find((a) => a.startsWith("--kind="))?.slice(7);
  const limitArg = process.argv.find((a) => a.startsWith("--limit="))?.slice(8);
  const limit = dryRun ? 3 : limitArg ? Number(limitArg) : null;

  if (!deepSeekConfigured()) {
    console.error("DEEPSEEK_API_KEY is not set — nothing to generate with.");
    process.exit(1);
  }

  const targets: Target[] = [];
  if (kindArg !== "kanji") targets.push(...(await grammarTargets(limit)));
  if (kindArg !== "grammar") targets.push(...(await kanjiTargets(limit)));

  console.log(`${targets.length} item(s) missing an example${dryRun ? " — DRY RUN, writing nothing" : ""}`);
  console.log(`  grammar: ${targets.filter((t) => t.kind === "grammar").length}   kanji: ${targets.filter((t) => t.kind === "kanji").length}\n`);
  if (targets.length === 0) return;

  let written = 0;
  let rejected = 0;
  let failed = 0;
  let costUsd = 0;

  for (let i = 0; i < targets.length; i += 1) {
    const t = targets[i];
    const label = `${String(i + 1).padStart(4)}/${targets.length}  ${t.kind.padEnd(7)} ${t.title.slice(0, 22).padEnd(24)}`;
    try {
      const result = await callDeepSeekJson({
        systemPrompt: SYSTEM,
        userMessage: userMessage(t),
        maxTokens: 300,
        temperature: 0.7,
        timeoutMs: 45_000,
      });
      costUsd += result.estimatedCostUsd;
      const gen = parseJsonResponse<Generated>(result.text);

      if (!gen?.sentence_ja?.trim() || !gen?.sentence_en?.trim()) {
        console.log(`${label} rejected — incomplete response`);
        rejected += 1;
        continue;
      }
      if (!containsTarget(t, gen.sentence_ja)) {
        console.log(`${label} rejected — "${gen.sentence_ja}" does not contain the target`);
        rejected += 1;
        continue;
      }

      if (dryRun) {
        console.log(`${label} ${gen.sentence_ja}`);
        console.log(`${" ".repeat(label.length)} ${gen.sentence_en}`);
        continue;
      }

      const column = t.kind === "grammar" ? "grammar_id" : "kanji_id";
      await sql.query(
        `INSERT INTO examples (${column}, sentence_ja, sentence_romaji, sentence_en, sort_order, notes)
         VALUES ($1::uuid, $2, $3, $4, 0, $5)`,
        [t.id, gen.sentence_ja.trim(), gen.sentence_romaji?.trim() ?? null, gen.sentence_en.trim(),
         "Generated by backfill-examples.ts — awaiting human review"]
      );
      // Live immediately, but flagged. See the header note on why this trade was taken.
      await sql`
        UPDATE posts SET review_state = 'needs_human_review', updated_at = NOW()
        WHERE id = ${t.postId}::uuid AND review_state <> 'needs_human_review'
      `;
      console.log(`${label} ${gen.sentence_ja}`);
      written += 1;
    } catch (err) {
      console.log(`${label} FAILED — ${(err as Error).message.slice(0, 70)}`);
      failed += 1;
    }
  }

  console.log(`\n${written} written, ${rejected} rejected by the contains-target check, ${failed} failed.`);
  console.log(`DeepSeek cost: $${costUsd.toFixed(4)}`);
  if (written > 0) console.log("Parent posts are flagged needs_human_review — check them in the Content Review Center.");
  if (rejected > 0) console.log("Rejected items keep no row and will be retried on the next run.");
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
