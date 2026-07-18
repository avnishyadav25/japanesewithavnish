/**
 * Phase E (block-system rollout): converts each `writing` post's Markdown
 * body into content_blocks. Unlike Reading, existing writing content is
 * already well-structured (H2-sectioned composition prompts: task/conditions,
 * model answer, evaluation points, practice advice) and substantial
 * (1000-2400 chars) — no AI regeneration needed, just a structural move.
 *
 * Reuses parseProseToBlocks (already proven for curriculum lessons) as-is:
 * splits the Markdown at H2 headers into (Section Heading, Rich Text) pairs.
 * This keeps all existing content — task description, model answer, rubric,
 * practice tips — intact, just moved into the new editable block shape.
 *
 * Also ensures the `writing` sidecar row exists for each post first, since
 * syncTypeTables.ts had no branch for "writing" until this same session
 * (existing writing posts never got a sidecar row synced).
 *
 * Every migrated block lands status='draft', review_status='pending' — a
 * human reviews and re-saves through the admin block editor to publish.
 * Idempotent: skips any post that already has content_blocks rows.
 *
 * Usage:
 *   npx tsx scripts/migrate-writing-posts-to-blocks.ts             # dry run
 *   npx tsx scripts/migrate-writing-posts-to-blocks.ts --apply     # inserts for real
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { writeFileSync } from "fs";
import { join } from "path";
import { validateBlockData } from "../src/lib/blocks/blockTypes";
import { parseProseToBlocks } from "../src/lib/curriculum/parseProseToBlocks";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
const sql = neon(DATABASE_URL);

const APPLY = process.argv.includes("--apply");

async function main() {
  const posts = (await sql`
    SELECT id, slug, title, content, (jlpt_level)[1] AS jlpt_level
    FROM posts WHERE content_type = 'writing' ORDER BY slug
  `) as { id: string; slug: string; title: string; content: string | null; jlpt_level: string | null }[];

  const alreadyMigrated = await sql`SELECT DISTINCT post_id FROM content_blocks`;
  const migratedIds = new Set((alreadyMigrated as { post_id: string }[]).map((r) => r.post_id));

  const report: {
    postId: string;
    slug: string;
    status: "planned" | "skipped_already_migrated" | "skipped_no_content";
    blockCounts: Record<string, number>;
    errors: string[];
  }[] = [];

  let totalInserted = 0;

  for (const post of posts) {
    if (migratedIds.has(post.id)) {
      report.push({ postId: post.id, slug: post.slug, status: "skipped_already_migrated", blockCounts: {}, errors: [] });
      continue;
    }
    if (!post.content?.trim()) {
      report.push({ postId: post.id, slug: post.slug, status: "skipped_no_content", blockCounts: {}, errors: [] });
      continue;
    }

    const blocks = parseProseToBlocks(post.content);
    const errors: string[] = [];
    for (const b of blocks) {
      const errs = validateBlockData(b.block_type, b.block_data);
      if (errs.length > 0) errors.push(`${b.block_type}: ${errs.join(", ")}`);
    }
    const blockCounts: Record<string, number> = {};
    for (const b of blocks) blockCounts[b.block_type] = (blockCounts[b.block_type] ?? 0) + 1;

    report.push({ postId: post.id, slug: post.slug, status: "planned", blockCounts, errors });

    if (APPLY && errors.length === 0) {
      // Ensure the sidecar row exists (syncTypeTables.ts had no "writing" branch
      // until this session — existing posts never got one synced).
      await sql`
        INSERT INTO writing (post_id, title, level, updated_at)
        VALUES (${post.id}, ${post.title}, ${post.jlpt_level}, NOW())
        ON CONFLICT (post_id) DO UPDATE SET title = EXCLUDED.title, level = EXCLUDED.level, updated_at = NOW()
      `;

      let sortOrder = 10;
      for (const b of blocks) {
        await sql`
          INSERT INTO content_blocks (post_id, block_type, block_data, sort_order, status, review_status)
          VALUES (${post.id}, ${b.block_type}, ${JSON.stringify(b.block_data)}::jsonb, ${sortOrder}, 'draft', 'pending')
        `;
        sortOrder += 10;
        totalInserted++;
      }
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = join(__dirname, "backups", `writing-block-migration-${APPLY ? "apply" : "dry-run"}-${timestamp}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  const planned = report.filter((r) => r.status === "planned");
  const withErrors = planned.filter((r) => r.errors.length > 0);
  const skippedMigrated = report.filter((r) => r.status === "skipped_already_migrated").length;
  const skippedNoContent = report.filter((r) => r.status === "skipped_no_content").length;

  console.log(`\nMode: ${APPLY ? "APPLY" : "DRY RUN"}`);
  console.log(`Posts total: ${posts.length}`);
  console.log(`Planned: ${planned.length}, with validation errors: ${withErrors.length}`);
  console.log(`Skipped (already migrated): ${skippedMigrated}, skipped (no content): ${skippedNoContent}`);
  if (APPLY) console.log(`Blocks inserted: ${totalInserted}`);
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
