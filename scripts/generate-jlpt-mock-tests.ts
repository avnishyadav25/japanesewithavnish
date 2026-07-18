/**
 * Generates real JLPT-style mock tests: 2 full + 1 mini per level (N5-N1) = 15 posts.
 * Thin CLI wrapper around src/lib/practiceTest/generateMockTest.ts (the same library the admin
 * "Generate with AI" modal uses, one step per HTTP round trip there — here we just run all
 * steps in a tight synchronous loop since a CLI process has no request-timeout concern).
 *
 * IMPORTANT: every generated post lands with status='draft' — do not change this to
 * 'published'. Mock-test content needs founder review before going live. Review + flip to
 * published via the existing admin practice-test editor.
 *
 * Usage:
 *   npx tsx scripts/generate-jlpt-mock-tests.ts --level=N5 --variant=mini            # dry run
 *   npx tsx scripts/generate-jlpt-mock-tests.ts --level=N5 --variant=mini --apply    # for real
 *   npx tsx scripts/generate-jlpt-mock-tests.ts --apply                              # all 15
 */
import "dotenv/config";
import { writeFileSync } from "fs";
import { join } from "path";
import type { JlptLevel } from "../src/lib/practiceTest/itemTypes";
import { buildStepPlan, initJobState, runStep, finalizeNewTest, alreadyHasContent } from "../src/lib/practiceTest/generateMockTest";

// ---------- CLI args ----------
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const FORCE = args.includes("--force");
function argValue(name: string): string | undefined {
  const found = args.find((a) => a.startsWith(`--${name}=`));
  return found?.split("=")[1];
}
const LEVEL_FILTER = argValue("level")?.split(",").map((s) => s.trim().toUpperCase()) as JlptLevel[] | undefined;
const VARIANT_FILTER = argValue("variant"); // "full" | "mini" | "all" | undefined
const LIMIT = argValue("limit") ? parseInt(argValue("limit")!, 10) : undefined;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type ReportEntry = {
  slug: string;
  level: JlptLevel;
  variant: string;
  status: "created" | "planned" | "skipped_already_exists" | "failed";
  sections: number;
  questions: number;
  audioFiles: number;
  errors: string[];
};

async function generateOneTest(level: JlptLevel, variant: "full" | "mini", index: number, report: ReportEntry[]) {
  const slug = `jlpt-${level.toLowerCase()}-${variant}-mock${variant === "full" ? `-${index}` : ""}`;
  const title = `${level} ${variant === "full" ? `Full Mock Test ${index}` : "Mini Mock Test"}`;

  if (!FORCE && (await alreadyHasContent(slug))) {
    console.log(`Skipping ${slug} (already has content)`);
    report.push({ slug, level, variant, status: "skipped_already_exists", sections: 0, questions: 0, audioFiles: 0, errors: [] });
    return;
  }

  console.log(`\n=== Generating ${slug} ===`);
  const state = initJobState(level, variant, slug, title, null);
  const steps = buildStepPlan(level, variant);

  try {
    for (const step of steps) {
      if (step.kind === "finalize") continue;
      const logLine = await runStep(state, step);
      console.log(`  ${logLine}`);
      await sleep(400);
    }

    if (APPLY) {
      const result = await finalizeNewTest(state);
      console.log(`  Inserted: ${state.sections.length} sections, ${result.totalQuestions} questions, ${result.durationMinutes} min total, ${state.audioFiles} audio files`);
      report.push({ slug, level, variant, status: "created", sections: state.sections.length, questions: result.totalQuestions, audioFiles: state.audioFiles, errors: [] });
    } else {
      const totalQ = state.sections.reduce((sum, s) => sum + s.questions.length, 0);
      console.log(`  [DRY RUN] Would insert: ${state.sections.length} sections, ${totalQ} questions, ${state.audioFiles} audio files`);
      report.push({ slug, level, variant, status: "planned", sections: state.sections.length, questions: totalQ, audioFiles: state.audioFiles, errors: [] });
    }
  } catch (e) {
    // finalizeNewTest cleans up its own partial post on failure — nothing left to roll back here.
    const msg = (e as Error).message;
    console.error(`  FAILED: ${msg}`);
    report.push({ slug, level, variant, status: "failed", sections: 0, questions: 0, audioFiles: 0, errors: [msg] });
  }
}

async function main() {
  const levels: JlptLevel[] = LEVEL_FILTER ?? ["N5", "N4", "N3", "N2", "N1"];
  const variants: ("full" | "mini")[] =
    VARIANT_FILTER === "full" ? ["full"] : VARIANT_FILTER === "mini" ? ["mini"] : ["full", "mini"];

  const targets: { level: JlptLevel; variant: "full" | "mini"; index: number }[] = [];
  for (const level of levels) {
    for (const variant of variants) {
      if (variant === "full") {
        targets.push({ level, variant, index: 1 }, { level, variant, index: 2 });
      } else {
        targets.push({ level, variant, index: 1 });
      }
    }
  }
  const limited = LIMIT ? targets.slice(0, LIMIT) : targets;

  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}`);
  console.log(`Targets: ${limited.length}`);

  const report: ReportEntry[] = [];
  for (const t of limited) {
    await generateOneTest(t.level, t.variant, t.index, report);
    await sleep(500);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = join(__dirname, "backups", `jlpt-mock-tests-${APPLY ? "apply" : "dry-run"}-${timestamp}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  const created = report.filter((r) => r.status === "created").length;
  const planned = report.filter((r) => r.status === "planned").length;
  const skipped = report.filter((r) => r.status === "skipped_already_exists").length;
  const failed = report.filter((r) => r.status === "failed").length;
  console.log(`\nCreated: ${created}, Planned (dry run): ${planned}, Skipped: ${skipped}, Failed: ${failed}`);
  console.log(`Report: ${reportPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
