/**
 * Phase 3 (Curriculum CMS): converts each lesson's Markdown main body into
 * lesson_blocks. Prose stays as Markdown (rich_text blocks render through the
 * same interactive LearnMarkdown pipeline as today — TTS buttons, writing-practice
 * modal, callout boxes all keep working), split at H2 headers into
 * (Section Heading, Rich Text) pairs.
 *
 * Deliberately does NOT generate Vocabulary Set / Grammar Rule / Kanji Focus /
 * Kana Grid / Example Set blocks from already-linked data: the student lesson
 * page already has an unconditional "Lesson Materials" sidebar and "Examples"
 * section rendering that same linked data, so auto-generating reference blocks
 * here would duplicate it inside "Lesson Content" too.
 *
 * Run scripts/backup-curriculum-content.ts FIRST.
 *
 * Usage:
 *   npx tsx scripts/migrate-lessons-to-blocks.ts             # dry run, writes a report
 *   npx tsx scripts/migrate-lessons-to-blocks.ts --apply     # inserts lesson_blocks rows for real
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { writeFileSync } from "fs";
import { join } from "path";
import { validateBlockData } from "../src/lib/curriculum/blockTypes";
import { parseProseToBlocks } from "../src/lib/curriculum/parseProseToBlocks";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
const sql = neon(DATABASE_URL);

const APPLY = process.argv.includes("--apply");
const lessonIdsArg = process.argv.find((a) => a.startsWith("--lesson-ids="));
const LESSON_ID_FILTER = lessonIdsArg ? new Set(lessonIdsArg.split("=")[1].split(",")) : null;

async function main() {
  const lessons = await sql`SELECT id, code, title FROM curriculum_lessons ORDER BY code`;
  const alreadyMigrated = await sql`SELECT DISTINCT lesson_id FROM lesson_blocks`;
  const migratedIds = new Set((alreadyMigrated as { lesson_id: string }[]).map((r) => r.lesson_id));

  const mainContent = await sql`
    SELECT clc.lesson_id, p.content
    FROM curriculum_lesson_content clc JOIN posts p ON p.id = clc.post_id
    WHERE clc.content_role = 'main'
  `;
  const contentByLesson = new Map((mainContent as { lesson_id: string; content: string }[]).map((r) => [r.lesson_id, r.content]));

  const report: {
    lessonId: string;
    code: string;
    title: string;
    status: "planned" | "skipped_already_migrated" | "skipped_no_content";
    blockCounts: Record<string, number>;
    errors: string[];
  }[] = [];

  let totalInserted = 0;

  for (const lesson of lessons as { id: string; code: string; title: string }[]) {
    if (LESSON_ID_FILTER && !LESSON_ID_FILTER.has(lesson.id)) continue;
    if (migratedIds.has(lesson.id)) {
      report.push({ lessonId: lesson.id, code: lesson.code, title: lesson.title, status: "skipped_already_migrated", blockCounts: {}, errors: [] });
      continue;
    }
    const markdown = contentByLesson.get(lesson.id);
    if (!markdown || !markdown.trim()) {
      report.push({ lessonId: lesson.id, code: lesson.code, title: lesson.title, status: "skipped_no_content", blockCounts: {}, errors: [] });
      continue;
    }

    const blocks = parseProseToBlocks(markdown);

    const errors: string[] = [];
    for (const b of blocks) {
      const errs = validateBlockData(b.block_type, b.block_data);
      if (errs.length > 0) errors.push(`${b.block_type}: ${errs.join(", ")}`);
    }

    const blockCounts: Record<string, number> = {};
    for (const b of blocks) blockCounts[b.block_type] = (blockCounts[b.block_type] ?? 0) + 1;

    report.push({ lessonId: lesson.id, code: lesson.code, title: lesson.title, status: "planned", blockCounts, errors });

    if (APPLY && errors.length === 0) {
      let sortOrder = 10;
      for (const b of blocks) {
        await sql`
          INSERT INTO lesson_blocks (lesson_id, block_type, block_data, sort_order, status)
          VALUES (${lesson.id}, ${b.block_type}, ${JSON.stringify(b.block_data)}::jsonb, ${sortOrder}, 'published')
        `;
        sortOrder += 10;
        totalInserted++;
      }
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = join(__dirname, "backups", `curriculum-block-migration-${APPLY ? "apply" : "dry-run"}-${timestamp}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  const planned = report.filter((r) => r.status === "planned");
  const withErrors = planned.filter((r) => r.errors.length > 0);
  const skippedMigrated = report.filter((r) => r.status === "skipped_already_migrated").length;
  const skippedNoContent = report.filter((r) => r.status === "skipped_no_content").length;

  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}`);
  console.log(`Lessons total: ${lessons.length}`);
  console.log(`Planned: ${planned.length}, with validation errors: ${withErrors.length}`);
  console.log(`Skipped (already migrated): ${skippedMigrated}, skipped (no content): ${skippedNoContent}`);
  if (APPLY) console.log(`Blocks inserted: ${totalInserted}`);
  if (withErrors.length > 0) {
    console.log("\nLessons with validation errors (not applied even in --apply mode):");
    for (const r of withErrors) console.log(`  ${r.code} ${r.title}: ${r.errors.join(" | ")}`);
  }
  console.log(`\nFull report: ${reportPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
