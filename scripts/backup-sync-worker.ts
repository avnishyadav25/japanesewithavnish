import "dotenv/config";
import { runBackupSyncBatch } from "../src/lib/db-backup";
import { sql } from "../src/lib/db";

/**
 * Runs the full-database archive sync to completion, somewhere with no function timeout.
 *
 *   npm run backup:worker           # resume or start; respects the 20h cooldown
 *   npm run backup:worker -- --force # start a fresh run regardless of cooldown
 *
 * Why this is not a Netlify cron any more: the job copies every table to Turso and R2, and
 * writeToTurso() sends 200 rows per HTTP round trip. content_events alone is 5,332 rows —
 * 27 sequential calls to Turso plus a 3.7MB R2 upload — against a ~30s function ceiling.
 * Eight tables exceed 2,000 rows and the largest is 11,550, so no batch size makes this fit;
 * the work is simply larger than a serverless invocation. Same conclusion, and the same fix,
 * as the content-review worker and the video render worker before it.
 *
 * The per-table progress commit in runBackupSyncBatch stays load-bearing: it is what lets a
 * killed run resume rather than restart, whatever the host.
 */

async function main() {
  if (!sql) {
    console.error("DATABASE_URL not set — nothing to back up.");
    process.exit(1);
  }
  if (!process.env.TURSO_DB_URL || !process.env.TURSO_DB_AUTH_TOKEN) {
    // Not fatal: R2 is an independent destination and a Turso-less backup is still a backup.
    // But it must be loud — this exact misconfiguration silently produced 138 failed table
    // writes a day while the job reported "completed".
    console.warn("WARNING: TURSO_DB_URL/TURSO_DB_AUTH_TOKEN not set — Turso writes will all fail. R2 will still receive data.");
  }

  const force = process.argv.includes("--force");
  let calls = 0;

  // Each call processes up to BATCH_SIZE tables and commits after every one, so looping here
  // is just "keep going until done" — a crash mid-loop loses nothing already committed.
  for (;;) {
    const result = await runBackupSyncBatch(calls === 0 ? force : false);
    calls++;

    if (result.status === "idle") {
      console.log(`idle — last run completed recently, next eligible ${result.nextRunAt}. Use --force to override.`);
      return;
    }

    console.log(
      `call ${calls}: ${result.status} — ${result.nextOffset}/${result.totalTables} tables ` +
        `(ok=${result.tablesSyncedOk} failed=${result.tablesSyncedFailed})`
    );

    if (result.status === "completed") {
      if (result.tablesSyncedFailed > 0) {
        console.error(`FAILED: ${result.tablesSyncedFailed} table(s) did not archive cleanly — check backup_sync_log.`);
        process.exit(1);
      }
      console.log(`done: ${result.totalTables} tables archived in ${calls} call(s).`);
      return;
    }

    // A run that stops advancing would spin forever; bail loudly instead.
    if (calls > 500) {
      console.error("ABORT: over 500 calls without completing — the sync is not advancing.");
      process.exit(1);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
