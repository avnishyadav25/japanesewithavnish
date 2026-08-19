/**
 * What the render queue holds, for the CI workflow to branch on.
 *
 * Two expensive setup steps ran unconditionally before this existed: a Chromium install and an
 * apt-get for CJK fonts, together several minutes, on EVERY scheduled run — and the schedule fires
 * four times an hour whether or not anything is queued. Worse, `playwright install --with-deps`
 * shells out to apt, which hangs for ten minutes when GitHub's Azure Ubuntu mirror is unreachable
 * (observed: run #291, 9m43s of `Ign: azure.archive.ubuntu.com` before falling back).
 *
 * So the workflow asks first. Chromium is only needed for B-roll capture — nothing else in the
 * render path uses Playwright — so it is installed only when a queued job actually captures a page.
 *
 * Writes GitHub Actions outputs; prints the same to stdout so a human reading the log sees why the
 * run did or did not do any work.
 */
import { config as loadEnv } from "dotenv";
import { appendFileSync } from "fs";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

async function main() {
  const { sql } = await import("../src/lib/db");
  if (!sql) throw new Error("DATABASE_URL is not set");

  // EXACTLY the predicate claimNextJob uses (scripts/lib/video/db.ts) — queued, or claimed/running
  // with a stale HEARTBEAT. Measured from heartbeat_at, not claimed_at: a 1080p render legitimately
  // runs longer than any fixed claim timeout, and a claimed_at rule would count healthy in-progress
  // work as reclaimable. If this predicate drifts from the worker's, the workflow skips runs that
  // have work, or sets up a runner that finds none.
  const { STALE_HEARTBEAT_MINUTES } = await import("./lib/video/db");
  const rows = (await sql`
    SELECT
      COUNT(*) FILTER (WHERE claimable)::int AS jobs,
      COUNT(*) FILTER (WHERE claimable AND p.include_broll)::int AS broll
    FROM (
      SELECT j.project_id,
             (j.status = 'queued'
              OR (j.status IN ('claimed', 'running')
                  AND j.heartbeat_at < NOW() - make_interval(mins => ${STALE_HEARTBEAT_MINUTES}))) AS claimable
      FROM video_render_jobs j
    ) j
    JOIN video_projects p ON p.id = j.project_id
  `) as { jobs: number; broll: number }[];

  const jobs = Number(rows[0]?.jobs ?? 0);
  const broll = Number(rows[0]?.broll ?? 0);

  console.log(`Render queue: ${jobs} claimable job(s), ${broll} needing B-roll capture.`);
  if (jobs === 0) console.log("Nothing to do — the rest of this run is skipped.");
  else if (broll === 0) console.log("No B-roll in the queue, so Chromium is not installed.");

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `jobs=${jobs}\nbroll=${broll > 0}\n`);
  }
}

main().then(() => process.exit(0)).catch((err) => {
  // A failure here must NOT silently skip the render. Exit non-zero so the run fails loudly rather
  // than reporting "nothing queued" because the database was unreachable.
  console.error(err);
  process.exit(1);
});
