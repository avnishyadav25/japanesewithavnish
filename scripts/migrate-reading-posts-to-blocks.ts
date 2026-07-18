/**
 * Phase C (block-system rollout): converts each published `reading` post's
 * posts.content into a single content_blocks `reading_passage` block.
 *
 * Content-quality audit (2026-07-17) found 42/47 published reading posts under
 * 300 characters and at least 6 with the post's English title pasted directly
 * into the Japanese passage (e.g. "...Hello and goodbyeをべんきょうします。").
 * Posts matching either symptom are "flagged" and get an AI-drafted replacement
 * passage instead of a straight structural copy — still landing in the same
 * draft/pending-review state, since a human still needs to approve it.
 *
 * Every migrated block lands status='draft', review_status='pending' — this
 * script's job is to get content into the new shape and, for flagged posts,
 * draft a better replacement; a human approves via the admin block editor.
 * Idempotent: skips any post that already has content_blocks rows.
 *
 * Usage:
 *   npx tsx scripts/migrate-reading-posts-to-blocks.ts             # dry run, writes a report
 *   npx tsx scripts/migrate-reading-posts-to-blocks.ts --apply     # inserts content_blocks rows for real
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

const ENGLISH_MIXED_IN_RE = /[a-zA-Z]{4,}を|[a-zA-Z]{4,}が|[a-zA-Z]{4,}は/;
const THIN_CONTENT_THRESHOLD = 300;

type Post = {
  id: string;
  slug: string;
  title: string;
  content: string | null;
  jlpt_level: string[] | null;
  status: string;
};

function isFlagged(post: Post): { flagged: boolean; reason: string } {
  const content = post.content ?? "";
  if (content.length < THIN_CONTENT_THRESHOLD) return { flagged: true, reason: `thin content (${content.length} chars)` };
  if (ENGLISH_MIXED_IN_RE.test(content)) return { flagged: true, reason: "English text mixed into Japanese passage" };
  return { flagged: false, reason: "" };
}

async function generateCleanPassage(post: Post): Promise<{ passage: string; translation: string } | null> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  const level = post.jlpt_level?.[0] ?? "N5";
  const systemPrompt = `You write short Japanese reading-comprehension passages for JLPT learners. Output ONLY valid JSON: {"passage": "...", "translation": "..."}. The passage must be 100% natural Japanese (no English words mixed in), appropriate for JLPT ${level} level, at least 300 characters, 3-6 sentences, on the given topic. The translation is a natural English translation of the whole passage.`;
  const userMessage = `Topic: "${post.title}". Write a natural JLPT ${level} reading passage about this topic.`;

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
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    console.error(`  DeepSeek error for ${post.slug}: ${res.status} ${await res.text().catch(() => "")}`);
    return null;
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content ?? "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as { passage?: string; translation?: string };
    if (!parsed.passage || !parsed.translation) return null;
    return { passage: parsed.passage, translation: parsed.translation };
  } catch {
    return null;
  }
}

async function main() {
  const posts = (await sql`
    SELECT id, slug, title, content, jlpt_level, status
    FROM posts WHERE content_type = 'reading' ORDER BY slug
  `) as Post[];

  const alreadyMigrated = await sql`SELECT DISTINCT post_id FROM content_blocks`;
  const migratedIds = new Set((alreadyMigrated as { post_id: string }[]).map((r) => r.post_id));

  const report: {
    postId: string;
    slug: string;
    title: string;
    status: "planned_structural" | "planned_regenerated" | "skipped_already_migrated" | "skipped_no_content" | "regeneration_failed";
    flagReason: string;
    errors: string[];
  }[] = [];

  let inserted = 0;
  let regenerated = 0;

  for (const post of posts) {
    if (migratedIds.has(post.id)) {
      report.push({ postId: post.id, slug: post.slug, title: post.title, status: "skipped_already_migrated", flagReason: "", errors: [] });
      continue;
    }
    if (!post.content?.trim()) {
      report.push({ postId: post.id, slug: post.slug, title: post.title, status: "skipped_no_content", flagReason: "", errors: [] });
      continue;
    }

    const { flagged, reason } = isFlagged(post);
    let passage = post.content.replace(/^#\s+.+\n+/, "").trim(); // strip redundant "# Title" H1 line
    let translation: string | undefined;
    let generatedByModel: string | null = null;
    let status: "planned_structural" | "planned_regenerated" | "regeneration_failed" = "planned_structural";

    if (flagged) {
      console.log(`Regenerating ${post.slug} (${reason})...`);
      const result = APPLY ? await generateCleanPassage(post) : null;
      if (APPLY && !result) {
        report.push({ postId: post.id, slug: post.slug, title: post.title, status: "regeneration_failed", flagReason: reason, errors: ["AI generation failed or DEEPSEEK_API_KEY missing"] });
        continue;
      }
      if (result) {
        passage = result.passage;
        translation = result.translation;
        generatedByModel = "deepseek-chat";
        status = "planned_regenerated";
        regenerated++;
      } else {
        status = "planned_regenerated"; // dry-run: report intent without calling the API
      }
    }

    const blockData: Record<string, unknown> = { title: post.title, passage };
    if (translation) blockData.translation = translation;

    const errors = validateBlockData("reading_passage", blockData);
    report.push({ postId: post.id, slug: post.slug, title: post.title, status, flagReason: reason, errors });

    if (APPLY && errors.length === 0) {
      await sql`
        INSERT INTO content_blocks (post_id, block_type, block_data, sort_order, status, review_status, generated_by_model)
        VALUES (${post.id}, 'reading_passage', ${JSON.stringify(blockData)}::jsonb, 10, 'draft', 'pending', ${generatedByModel})
      `;
      inserted++;
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = join(__dirname, "backups", `reading-block-migration-${APPLY ? "apply" : "dry-run"}-${timestamp}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  const structural = report.filter((r) => r.status === "planned_structural").length;
  const regen = report.filter((r) => r.status === "planned_regenerated").length;
  const failed = report.filter((r) => r.status === "regeneration_failed").length;
  const skippedMigrated = report.filter((r) => r.status === "skipped_already_migrated").length;
  const skippedNoContent = report.filter((r) => r.status === "skipped_no_content").length;

  console.log(`\nMode: ${APPLY ? "APPLY" : "DRY RUN"}`);
  console.log(`Posts total: ${posts.length}`);
  console.log(`Planned structural (clean content, copied as-is): ${structural}`);
  console.log(`Planned regenerated (flagged, AI-drafted replacement): ${regen}`);
  console.log(`Regeneration failed: ${failed}`);
  console.log(`Skipped (already migrated): ${skippedMigrated}, skipped (no content): ${skippedNoContent}`);
  if (APPLY) console.log(`Blocks inserted: ${inserted} (${regenerated} AI-regenerated)`);
  console.log(`\nFull report: ${reportPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
