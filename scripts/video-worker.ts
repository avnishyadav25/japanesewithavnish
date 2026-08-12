/**
 * Video Studio render worker.
 *
 * One portable CLI that runs identically on a developer Mac and on a GitHub Actions runner —
 * it claims jobs from Postgres rather than being handed work, so the two never conflict and
 * either can be absent without the other noticing.
 *
 *   npm run video:worker                              daemon; polls every 5s (Mac)
 *   npm run video:worker -- --once --max-jobs=2       drain and exit (GitHub Actions)
 *   npm run video:worker -- --job=<uuid>              force one specific job
 *
 * Why not a Netlify function: rendering needs a headless Chrome and ffmpeg, neither of which
 * exists in a Netlify function, and a 1080p render runs minutes-to-tens-of-minutes against a
 * ~10 second execution limit.
 *
 * Requires: DATABASE_URL, R2_*, GOOGLE_TTS_SERVICE_ACCOUNT_* (or the Sheets service account
 * with the Cloud Text-to-Speech API enabled), and ffmpeg on PATH.
 */
import "dotenv/config";
import os from "os";
import { claimNextJob, failJob, heartbeat, sql, type ClaimedJob } from "./lib/video/db";
import { JobCancelled, runJob } from "./lib/video/pipeline";

const POLL_INTERVAL_MS = 5_000;
const HEARTBEAT_INTERVAL_MS = 30_000;

interface Args {
  once: boolean;
  maxJobs: number;
  jobId: string | null;
  runner: "local" | "github-actions";
  concurrency: number | undefined;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string): string | undefined => {
    const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
    if (!hit) return undefined;
    return hit.includes("=") ? hit.split("=").slice(1).join("=") : "true";
  };
  const runner = get("runner");
  return {
    once: get("once") === "true",
    maxJobs: Number(get("max-jobs") ?? 0) || Number.POSITIVE_INFINITY,
    jobId: get("job") && get("job") !== "true" ? (get("job") as string) : null,
    runner: runner === "github-actions" ? "github-actions" : "local",
    concurrency: get("concurrency") ? Number(get("concurrency")) : undefined,
  };
}

/** Identifies which machine/run holds a claim, so a stuck job in the admin monitor can be
 * traced to a specific Actions run or laptop rather than just "something, somewhere". */
function runnerId(runner: string): string {
  if (runner === "github-actions") {
    const repo = process.env.GITHUB_REPOSITORY ?? "gh";
    const runIdEnv = process.env.GITHUB_RUN_ID ?? "unknown";
    return `${repo}#${runIdEnv}`;
  }
  return `${os.hostname()}:${process.pid}`;
}

/** Claims a specific job by id, for `--job=<uuid>`. Same guard as the queue claim: refuses a
 * job another runner is actively working. */
async function claimSpecificJob(jobId: string, runner: string, id: string): Promise<ClaimedJob | null> {
  const rows = (await sql`
    UPDATE video_render_jobs
    SET status = 'claimed', claimed_at = NOW(), heartbeat_at = NOW(),
        started_at = COALESCE(started_at, NOW()), attempt_count = attempt_count + 1,
        runner = ${runner}, runner_id = ${id}
    WHERE id = ${jobId}::uuid
      AND (status IN ('queued', 'failed')
           OR (status IN ('claimed', 'running') AND heartbeat_at < NOW() - INTERVAL '5 minutes'))
    RETURNING id, project_id, storyboard_id, format, attempt_count, max_attempts
  `) as Record<string, string | number>[];
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    storyboardId: String(row.storyboard_id),
    format: row.format as ClaimedJob["format"],
    attemptCount: Number(row.attempt_count),
    maxAttempts: Number(row.max_attempts),
  };
}

let shuttingDown = false;

async function processOne(job: ClaimedJob, args: Args, id: string): Promise<void> {
  console.log(`[video-worker] claimed ${job.id} (${job.format}, attempt ${job.attemptCount}/${job.maxAttempts})`);

  // Keep the claim alive for the whole render. Without this the stale-reclaim window would
  // hand a long render to a second worker halfway through and both would upload.
  const beat = setInterval(() => {
    heartbeat(job.id).catch((err) => console.warn("[video-worker] heartbeat failed:", err.message));
  }, HEARTBEAT_INTERVAL_MS);

  try {
    await runJob(job, { runnerLabel: args.runner, concurrency: args.concurrency });
    console.log(`[video-worker] completed ${job.id}`);
  } catch (err) {
    if (err instanceof JobCancelled) {
      console.log(`[video-worker] ${job.id} was cancelled — stopping cleanly`);
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[video-worker] job ${job.id} failed:`, err);
    await failJob(job, message);
  } finally {
    clearInterval(beat);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const id = runnerId(args.runner);
  console.log(
    `[video-worker] starting — runner=${args.runner} id=${id} mode=${args.once ? "once" : "daemon"}` +
      (Number.isFinite(args.maxJobs) ? ` maxJobs=${args.maxJobs}` : "")
  );

  if (args.jobId) {
    const job = await claimSpecificJob(args.jobId, args.runner, id);
    if (!job) {
      console.error(`[video-worker] job ${args.jobId} is not claimable (already running, or does not exist)`);
      process.exitCode = 1;
      return;
    }
    await processOne(job, args, id);
    return;
  }

  let processed = 0;
  while (!shuttingDown && processed < args.maxJobs) {
    const job = await claimNextJob(args.runner, id);

    if (!job) {
      if (args.once) {
        console.log(`[video-worker] queue empty — processed ${processed} job(s), exiting`);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      continue;
    }

    await processOne(job, args, id);
    processed += 1;
  }

  console.log(`[video-worker] done — processed ${processed} job(s)`);
}

// A killed worker should stop claiming immediately, but let the in-flight render finish rather
// than leaving a half-uploaded MP4 and a job row that has to wait out the stale window.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (shuttingDown) process.exit(1);
    shuttingDown = true;
    console.log(`\n[video-worker] ${signal} received — finishing the current job, then exiting. Press again to force.`);
  });
}

main().catch((err) => {
  console.error("[video-worker] fatal:", err);
  process.exit(1);
});
