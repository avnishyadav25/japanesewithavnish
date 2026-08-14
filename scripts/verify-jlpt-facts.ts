import "dotenv/config";
import { sql } from "../src/lib/db";
import { callDeepSeekWithReasoning } from "../src/lib/ai/deepseek-curriculum";

/**
 * P0-3: Scans exam-related content for JLPT factual claims (section timing, passing scores,
 * question counts) and flags anything that doesn't match the official current figures.
 * Read-only report — never edits content. Review the flagged list, then fix manually
 * (see the two known fixes already applied: N5 timing, N2 passing score).
 *
 * Usage: npx tsx scripts/verify-jlpt-facts.ts
 */

const EXAM_FACT_KEYWORDS = [
  "passing score",
  "pass mark",
  "minutes",
  "scored out of",
  "section",
  "sectional",
  "question",
  "format",
  "/180",
  "/60",
];

const SYSTEM_PROMPT = `You are a JLPT (Japanese Language Proficiency Test) fact-checker. You will be given an article excerpt that may mention JLPT exam mechanics (section timing, passing scores, question counts, number of sections).

Compare any such claims against these OFFICIAL current figures:
- N5: Vocabulary 20 min / Grammar+Reading 40 min / Listening 30 min. Pass: 80/180 overall, min 38/120 in Language Knowledge+Reading combined, min 19/60 in Listening.
- N4: Vocabulary 25 min / Grammar+Reading 55 min / Listening 35 min. Pass: 90/180 overall, min 38/120 in Language Knowledge+Reading combined, min 19/60 in Listening.
- N3: Vocabulary 30 min / Grammar+Reading 70 min / Listening 40 min. Pass: 95/180 overall, min 19/60 in each of Language Knowledge, Reading, Listening.
- N2: Language Knowledge+Reading 105 min / Listening 50 min. Pass: 90/180 overall, min 19/60 in each of Language Knowledge, Reading, Listening.
- N1: Language Knowledge+Reading 110 min / Listening 55 min. Pass: 100/180 overall, min 19/60 in each of Language Knowledge, Reading, Listening.
(Timing/format changes periodically — treat the above as the reference to check against, but flag low-confidence matches too.)

Respond with ONLY a JSON object: { "hasClaims": boolean, "issues": [{ "claim": string, "problem": string, "confidence": "high"|"medium"|"low" }] }
If the excerpt makes no JLPT-mechanics claims, return { "hasClaims": false, "issues": [] }.
If claims are present and correct, return { "hasClaims": true, "issues": [] }.`;

type Post = { id: string; slug: string; title: string; content: string | null; content_type: string };

async function main() {
  if (!sql) throw new Error("Database not configured");

  const posts = (await sql`
    SELECT id, slug, title, content, content_type
    FROM posts
    WHERE status = 'published' AND content_type IN ('study_guide', 'blog')
    ORDER BY updated_at DESC
  `) as Post[];

  const candidates = posts.filter((p) => {
    const text = (p.content || "").toLowerCase();
    return EXAM_FACT_KEYWORDS.some((kw) => text.includes(kw));
  });

  console.log(`Scanning ${candidates.length} exam-fact candidate posts (of ${posts.length} total study_guide/blog posts)...\n`);

  const flagged: { slug: string; title: string; issues: unknown[] }[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const post = candidates[i];
    const excerpt = (post.content || "").slice(0, 6000);
    try {
      const result = await callDeepSeekWithReasoning({
        systemPrompt: SYSTEM_PROMPT,
        userMessage: `Title: ${post.title}\n\nExcerpt:\n${excerpt}`,
        parse: (obj) => obj as { hasClaims: boolean; issues: { claim: string; problem: string; confidence: string }[] },
        maxTokens: 1000,
      });

      process.stdout.write(`[${i + 1}/${candidates.length}] ${post.slug} — `);
      if (result.hasClaims && result.issues.length > 0) {
        console.log(`⚠️  ${result.issues.length} issue(s) flagged`);
        flagged.push({ slug: post.slug, title: post.title, issues: result.issues });
      } else {
        console.log("ok");
      }
    } catch (e) {
      console.log(`error: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`REVIEW REPORT: ${flagged.length} post(s) flagged for manual review\n`);
  for (const f of flagged) {
    console.log(`\n📄 ${f.title} (/blog/${f.slug})`);
    console.log(JSON.stringify(f.issues, null, 2));
  }
  if (flagged.length === 0) {
    console.log("No factual issues flagged beyond the 2 already fixed. Re-run periodically as content grows.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
