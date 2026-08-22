/**
 * Writes the reading passages and conversations that do not exist.
 *
 * TWO GAPS, BOTH FOUND BY QUERYING RATHER THAN BY ANYTHING FAILING.
 *
 * READING: 42 of 47 published reading posts have no passage. Their `content` is a two-line stub —
 * 「こんにちは。わたしは学生です。<topic>をべんきょうします。」 — around 100 characters, and their
 * `meta.sentences` is empty. Those pages are LIVE, so a visitor sees the boilerplate. Only 5 posts
 * (all N5) carry a real passage, which is why a three-passage video template produced one passage.
 *
 * CONVERSATION: zero posts, ever, against a fully-built `dialogue` scene with auto-scroll.
 *
 * Both write LIVE and flag the parent `needs_human_review`, matching scripts/backfill-examples.ts.
 * For reading that is strictly an improvement on what is already public; for conversation it is new
 * content that nobody is currently missing, and the flag is what keeps it visible.
 *
 * Usage:
 *   npx tsx scripts/generate-reading-dialogue.ts --kind=reading --dry-run
 *   npx tsx scripts/generate-reading-dialogue.ts --kind=reading
 *   npx tsx scripts/generate-reading-dialogue.ts --kind=conversation --level=N5 --count=20
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { callDeepSeekJson, deepSeekConfigured, parseJsonResponse } from "../src/lib/ai/deepseek";

config({ path: ".env.local" });
config({ path: ".env" });

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
const sql = neon(process.env.DATABASE_URL);

const LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;

interface Sentence {
  japanese: string;
  romaji: string;
  translation: string;
}
interface Turn {
  speaker: string;
  japanese: string;
  romaji: string;
  translation: string;
}

/** Japanese characters: kana or CJK. Used to prove a line is actually Japanese. */
const JA = /[぀-ヿ一-鿿]/;

const READING_SYSTEM = `You write short reading passages for a Japanese learning site.

Rules:
- Write a SINGLE coherent passage, not disconnected example sentences. It should read as one small story or description.
- Every sentence must be at or below the stated JLPT level. This is the whole point — an N5 reader cannot parse an N3 sentence.
- Natural Japanese. Not translated-from-English English.
- romaji is Hepburn, spaced by word, no macrons.
- translation is natural English, not a gloss.

Reply with JSON only:
{"sentences":[{"japanese":"...","romaji":"...","translation":"..."}]}`;

const DIALOGUE_SYSTEM = `You write short everyday conversations for a Japanese learning site.

Rules:
- A realistic exchange between exactly TWO people, alternating turns.
- Every line at or below the stated JLPT level.
- Use natural spoken Japanese, including the politeness level the situation calls for.
- speaker is a short label like "A" and "B", or a role like "Customer" and "Staff". Use the SAME two labels throughout, alternating.
- romaji is Hepburn, spaced by word, no macrons. translation is natural English.

Reply with JSON only:
{"title":"...","turns":[{"speaker":"A","japanese":"...","romaji":"...","translation":"..."}]}`;

/**
 * Sentence counts by level.
 *
 * An N5 reader loses the thread past about six sentences; an N1 passage that short is not reading
 * practice, it is a caption.
 */
const SENTENCES_BY_LEVEL: Record<string, number> = { N5: 6, N4: 7, N3: 8, N2: 9, N1: 10 };

/**
 * Refuses output rather than storing it.
 *
 * The examples backfill rejected 34 of 822 on its check, and the 23 that kept failing turned out to
 * be a real signal rather than noise. A generator with no failing case is untested.
 */
function validPassage(sentences: unknown, want: number): sentences is Sentence[] {
  if (!Array.isArray(sentences) || sentences.length < Math.max(4, want - 2)) return false;
  return sentences.every(
    (s) =>
      s && typeof s.japanese === "string" && JA.test(s.japanese) &&
      typeof s.translation === "string" && s.translation.trim().length > 0
  );
}

function validDialogue(turns: unknown): turns is Turn[] {
  if (!Array.isArray(turns) || turns.length < 4) return false;
  if (!turns.every((t) => t && typeof t.japanese === "string" && JA.test(t.japanese) && typeof t.speaker === "string")) {
    return false;
  }
  // Two speakers, alternating. A "conversation" that is one person talking is not one, and the
  // dialogue scene renders speakers as distinct columns — one speaker makes it a wall of text.
  const speakers = Array.from(new Set(turns.map((t) => String(t.speaker).trim())));
  if (speakers.length !== 2) return false;
  return turns.every((t, i) => i === 0 || String(t.speaker).trim() !== String(turns[i - 1].speaker).trim());
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
}

async function generateReading(dryRun: boolean, limit: number | null, level: string | null) {
  const rows = (await sql.query(
    `SELECT id, title, (jlpt_level)[1] AS lvl, summary, meta->>'lesson_title' AS lesson_title
     FROM posts
     WHERE status = 'published' AND content_type = 'reading'
       AND jsonb_array_length(COALESCE(meta->'sentences','[]'::jsonb)) = 0
       ${level ? "AND (jlpt_level)[1] = $1" : ""}
     ORDER BY CASE (jlpt_level)[1] WHEN 'N5' THEN 1 WHEN 'N4' THEN 2 WHEN 'N3' THEN 3 WHEN 'N2' THEN 4 ELSE 5 END, title
     ${limit ? `LIMIT ${limit}` : ""}`,
    level ? [level] : []
  )) as { id: string; title: string; lvl: string | null; summary: string | null; lesson_title: string | null }[];

  console.log(`${rows.length} reading post(s) with no passage${dryRun ? " — DRY RUN" : ""}\n`);
  let written = 0, rejected = 0, failed = 0, cost = 0;

  for (let i = 0; i < rows.length; i += 1) {
    const post = rows[i];
    const lvl = post.lvl ?? "N5";
    const want = SENTENCES_BY_LEVEL[lvl] ?? 7;
    const label = `${String(i + 1).padStart(3)}/${rows.length}  ${lvl}  ${post.title.slice(0, 44).padEnd(46)}`;
    try {
      const result = await callDeepSeekJson({
        systemPrompt: READING_SYSTEM,
        userMessage: [
          `Write a reading passage of about ${want} sentences.`,
          `JLPT level: ${lvl}`,
          `Topic: ${post.lesson_title || post.title}`,
          post.summary ? `Context: ${post.summary}` : "",
        ].filter(Boolean).join("\n"),
        maxTokens: 1400,
        temperature: 0.7,
        timeoutMs: 60_000,
      });
      cost += result.estimatedCostUsd;
      const parsed = parseJsonResponse<{ sentences?: unknown }>(result.text);

      if (!validPassage(parsed?.sentences, want)) {
        console.log(`${label} rejected — not a usable passage`);
        rejected += 1;
        continue;
      }
      const sentences = parsed.sentences;
      if (dryRun) {
        console.log(`${label} ${sentences.length} sentences`);
        console.log(`${" ".repeat(label.length)} ${sentences[0].japanese}`);
        continue;
      }

      // Both the structured field the video reads AND the markdown the page renders. Updating one
      // and not the other is how the page kept showing a stub while the data looked fixed.
      const markdown = [
        `# ${post.title}`,
        "",
        ...sentences.map((s) => s.japanese),
        "",
        "---",
        "",
        ...sentences.map((s) => `- ${s.japanese} — ${s.translation}`),
      ].join("\n");

      await sql.query(
        `UPDATE posts
         SET meta = COALESCE(meta,'{}'::jsonb) || jsonb_build_object('sentences', $2::jsonb),
             content = $3,
             review_state = 'needs_human_review',
             updated_at = NOW()
         WHERE id = $1::uuid`,
        [post.id, JSON.stringify(sentences), markdown]
      );
      console.log(`${label} ${sentences.length} sentences written`);
      written += 1;
    } catch (err) {
      console.log(`${label} FAILED — ${(err as Error).message.slice(0, 60)}`);
      failed += 1;
    }
  }

  console.log(`\n${written} written, ${rejected} rejected, ${failed} failed. DeepSeek cost $${cost.toFixed(4)}`);
  if (written > 0) console.log("Pages are live and flagged needs_human_review — read them in the Content Review Center.");
}

/** Situations worth a conversation, so twenty per level are not twenty variations of a greeting. */
const SITUATIONS = [
  "introducing yourself to a new classmate", "ordering food at a restaurant", "asking for directions to a station",
  "buying a train ticket", "checking into a hotel", "shopping for clothes and asking about size",
  "making a doctor's appointment", "talking about the weather with a neighbour", "asking a colleague for help at work",
  "ordering coffee and asking about the wifi", "returning something to a shop", "asking about opening hours",
  "meeting a friend and making weekend plans", "phoning to cancel an appointment", "asking a teacher to repeat something",
  "talking about a hobby you have just started", "apologising for being late", "asking a stranger to take a photo",
  "discussing a film you both watched", "asking about someone's family",
];

async function generateDialogue(dryRun: boolean, level: string | null, count: number) {
  const levels = level ? [level] : [...LEVELS];
  console.log(`${levels.length} level(s) x ${count} conversations${dryRun ? " — DRY RUN" : ""}\n`);
  let written = 0, rejected = 0, failed = 0, cost = 0;

  // RESUMABLE. The first run lost 12 conversations to truncated JSON and 3 to the validity check,
  // and re-running blind would have produced duplicates of the 85 that worked rather than filling
  // the 15 gaps. Situations already covered at a level are skipped, so a re-run is a top-up.
  const existing = (await sql.query(
    `SELECT (jlpt_level)[1] AS lvl, meta->>'situation' AS situation
     FROM posts WHERE content_type = 'conversation' AND meta ? 'situation'`
  )) as { lvl: string; situation: string }[];
  const covered = new Set(existing.map((r) => `${r.lvl}::${r.situation}`));

  for (const lvl of levels) {
    for (let i = 0; i < count; i += 1) {
      const situation = SITUATIONS[i % SITUATIONS.length];
      if (covered.has(`${lvl}::${situation}`)) continue;
      const label = `  ${lvl}  ${String(i + 1).padStart(2)}/${count}  ${situation.slice(0, 40).padEnd(42)}`;
      try {
        const result = await callDeepSeekJson({
          systemPrompt: DIALOGUE_SYSTEM,
          userMessage: `Write a conversation of 6 to 10 turns.\nJLPT level: ${lvl}\nSituation: ${situation}`,
          /**
           * Scaled by level, because the first run failed 12 of 100 on TRUNCATED JSON — almost all
           * at N1, where ten turns of longer sentences plus romaji and translation simply did not
           * fit 1600 tokens. The model was not wrong; the budget was.
           */
          maxTokens: lvl === "N1" || lvl === "N2" ? 3000 : 2200,
          temperature: 0.8,
          timeoutMs: 60_000,
        });
        cost += result.estimatedCostUsd;
        const parsed = parseJsonResponse<{ title?: string; turns?: unknown }>(result.text);

        if (!validDialogue(parsed?.turns)) {
          console.log(`${label} rejected — not a two-speaker alternating exchange`);
          rejected += 1;
          continue;
        }
        const turns = parsed.turns;
        const title = (parsed.title?.trim() || `${situation.replace(/^\w/, (c) => c.toUpperCase())}`).slice(0, 120);
        if (dryRun) {
          console.log(`${label} ${turns.length} turns — "${title}"`);
          console.log(`${" ".repeat(label.length)} ${turns[0].speaker}: ${turns[0].japanese}`);
          continue;
        }

        const slug = `${slugify(title)}-${lvl.toLowerCase()}-${Date.now().toString(36).slice(-4)}`;
        const markdown = [`# ${title}`, "", ...turns.map((t) => `**${t.speaker}:** ${t.japanese}  \n_${t.translation}_`)].join("\n");

        await sql.query(
          `INSERT INTO posts (slug, title, summary, content, content_type, content_surface, jlpt_level,
                              status, review_state, meta, published_at)
           VALUES ($1, $2, $3, $4, 'conversation', 'learn_library', ARRAY[$5]::text[],
                   'published', 'needs_human_review', $6::jsonb, NOW())
           ON CONFLICT (slug) DO NOTHING`,
          [slug, title, `A ${lvl} conversation: ${situation}.`, markdown, lvl,
           JSON.stringify({ situation, turns, generated: "generate-reading-dialogue.ts" })]
        );
        console.log(`${label} ${turns.length} turns`);
        written += 1;
      } catch (err) {
        console.log(`${label} FAILED — ${(err as Error).message.slice(0, 60)}`);
        failed += 1;
      }
    }
  }

  console.log(`\n${written} written, ${rejected} rejected, ${failed} failed. DeepSeek cost $${cost.toFixed(4)}`);
  if (written > 0) console.log("Published and flagged needs_human_review.");
}

/**
 * Listening clips for posts that have none.
 *
 * Surfaced by the coverage report rather than by anything failing: 7 of 16 listening posts have an
 * empty `meta.examples`, so a listening video for them plays nothing. Same shape as the reading
 * fix — the structured field the video reads is what is missing.
 */
async function generateListening(dryRun: boolean) {
  const rows = (await sql`
    SELECT id, title, (jlpt_level)[1] AS lvl, meta->>'lesson_title' AS lesson_title, summary
    FROM posts
    WHERE status = 'published' AND content_type = 'listening'
      AND jsonb_array_length(COALESCE(meta->'examples','[]'::jsonb)) = 0
    ORDER BY title
  `) as { id: string; title: string; lvl: string | null; lesson_title: string | null; summary: string | null }[];

  console.log(`${rows.length} listening post(s) with no clips${dryRun ? " — DRY RUN" : ""}\n`);
  let written = 0, rejected = 0, failed = 0, cost = 0;

  for (let i = 0; i < rows.length; i += 1) {
    const post = rows[i];
    const lvl = post.lvl ?? "N5";
    const label = `${String(i + 1).padStart(3)}/${rows.length}  ${lvl}  ${post.title.slice(0, 42).padEnd(44)}`;
    try {
      const result = await callDeepSeekJson({
        systemPrompt: READING_SYSTEM.replace("reading passages", "listening practice sentences").replace(
          "- Write a SINGLE coherent passage, not disconnected example sentences. It should read as one small story or description.",
          "- Write SEPARATE sentences, each a self-contained thing a learner could hear and understand on its own."
        ),
        userMessage: `Write 6 listening practice sentences.\nJLPT level: ${lvl}\nTopic: ${post.lesson_title || post.title}`,
        maxTokens: 1400,
        temperature: 0.7,
        timeoutMs: 60_000,
      });
      cost += result.estimatedCostUsd;
      const parsed = parseJsonResponse<{ sentences?: unknown }>(result.text);
      if (!validPassage(parsed?.sentences, 6)) {
        console.log(`${label} rejected`);
        rejected += 1;
        continue;
      }
      // Stored in the `examples` shape the resolver reads for listening, not the `sentences` shape
      // reading uses — the two content types read different keys and mixing them would store data
      // that looks right and resolves to nothing.
      const examples = parsed.sentences.map((x) => ({ ja: x.japanese, romaji: x.romaji, en: x.translation }));
      if (dryRun) {
        console.log(`${label} ${examples.length} clips — ${examples[0].ja}`);
        continue;
      }
      await sql.query(
        `UPDATE posts SET meta = COALESCE(meta,'{}'::jsonb) || jsonb_build_object('examples', $2::jsonb),
                          review_state = 'needs_human_review', updated_at = NOW()
         WHERE id = $1::uuid`,
        [post.id, JSON.stringify(examples)]
      );
      console.log(`${label} ${examples.length} clips written`);
      written += 1;
    } catch (err) {
      console.log(`${label} FAILED — ${(err as Error).message.slice(0, 60)}`);
      failed += 1;
    }
  }
  console.log(`\n${written} written, ${rejected} rejected, ${failed} failed. DeepSeek cost $${cost.toFixed(4)}`);
}

async function main() {
  const kind = process.argv.find((a) => a.startsWith("--kind="))?.slice(7);
  const dryRun = process.argv.includes("--dry-run");
  const level = process.argv.find((a) => a.startsWith("--level="))?.slice(8) ?? null;
  const limitArg = process.argv.find((a) => a.startsWith("--limit="))?.slice(8);
  const countArg = process.argv.find((a) => a.startsWith("--count="))?.slice(8);

  if (!deepSeekConfigured()) {
    console.error("DEEPSEEK_API_KEY is not set — nothing to generate with.");
    process.exit(1);
  }
  if (kind === "reading") {
    await generateReading(dryRun, dryRun ? 2 : limitArg ? Number(limitArg) : null, level);
  } else if (kind === "listening") {
    await generateListening(dryRun);
  } else if (kind === "conversation") {
    await generateDialogue(dryRun, level, dryRun ? 2 : countArg ? Number(countArg) : 20);
  } else {
    console.error("Pass --kind=reading, --kind=listening or --kind=conversation");
    process.exit(1);
  }
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
