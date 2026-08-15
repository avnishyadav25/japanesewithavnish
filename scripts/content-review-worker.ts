import "dotenv/config";
import { drainQueue, reapExhaustedJobs } from "../src/lib/contentReview/jobRunner";
import { sql } from "../src/lib/db";

/**
 * Drains the content-review queue from somewhere with no function timeout.
 *
 *   npm run review:worker                  # drain until empty (or the cost cap trips)
 *   npm run review:worker -- --max-jobs=5  # bounded run
 *   npm run review:worker -- --once        # a single job, for debugging
 *
 * Why this exists, in one line: review jobs measured a p90 of 64s and a max of 82s against a
 * Netlify function ceiling of ~30s, so the work cannot run there. Same reason
 * scripts/video-worker.ts exists — see the header of .github/workflows/video-render.yml.
 *
 * Safe to run alongside anything else: claimNextJob() uses FOR UPDATE SKIP LOCKED, so two
 * workers take different jobs rather than colliding.
 */

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=")[1];
}

async function queueDepth(): Promise<{ queued: number; running: number; failed: number }> {
  if (!sql) return { queued: 0, running: 0, failed: 0 };
  const rows = (await sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'queued')::int  AS queued,
      COUNT(*) FILTER (WHERE status IN ('claimed','running'))::int AS running,
      COUNT(*) FILTER (WHERE status = 'failed')::int  AS failed
    FROM content_review_jobs
  `) as { queued: number; running: number; failed: number }[];
  return rows[0] ?? { queued: 0, running: 0, failed: 0 };
}

async function main() {
  if (!sql) {
    console.error("DATABASE_URL is not set — nothing to drain.");
    process.exit(1);
  }
  if (!process.env.DEEPSEEK_API_KEY) {
    // Without a key the agents skip the LLM pass and every job "succeeds" having reviewed
    // nothing. Failing loudly beats silently marking 491 jobs complete.
    console.error("DEEPSEEK_API_KEY is not set — the review agents would skip the LLM pass and mark jobs done without reviewing them.");
    process.exit(1);
  }

  const once = process.argv.includes("--once");
  const maxJobs = once ? 1 : Number(arg("max-jobs") ?? 0) || Infinity;

  const before = await queueDepth();
  console.log(`queue before: queued=${before.queued} running=${before.running} failed=${before.failed}`);

  const reaped = await reapExhaustedJobs();
  if (reaped > 0) console.log(`reaped ${reaped} abandoned job(s) (attempts exhausted, never completed)`);

  // drainQueue processes up to `limit` and stops early when the queue is empty, so loop in
  // modest batches rather than one huge call: progress is visible in the log as it happens,
  // and a crash halfway still leaves everything before it committed.
  const BATCH = 5;
  let total = 0;
  while (total < maxJobs) {
    const want = Math.min(BATCH, maxJobs - total);
    const done = await drainQueue(want);
    if (done === 0) break;
    total += done;
    console.log(`  processed ${total} job(s)...`);
  }

  const after = await queueDepth();
  console.log(`processed ${total} job(s) this run`);
  console.log(`queue after:  queued=${after.queued} running=${after.running} failed=${after.failed}`);

  // A run that claimed nothing while jobs are still queued means something is wrong (cost cap
  // tripped, or every remaining job is past max_attempts) — worth surfacing, not exiting 0
  // quietly as if the work were done.
  if (total === 0 && after.queued > 0) {
    console.warn(`WARNING: ${after.queued} job(s) still queued but none could be claimed. Check the daily cost cap and attempt counts.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
