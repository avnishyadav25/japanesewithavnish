import "dotenv/config";
import { runFullReplicationPass, runReplicationPollPass } from "../src/lib/db/replication-poll";

/**
 * Runs one replication pass from the CLI, primary -> standby.
 *
 *   npm run db:replicate          # tier 1 only (the tight tables)
 *   npm run db:replicate -- full  # tier 2, every replicable table
 *
 * Useful for the first backfill after a standby rebuild, where every cursor starts null
 * and a full pass moves far more rows than a cron invocation should. Each table advances
 * by at most BATCH_SIZE per pass, so repeat until rowsSynced reaches 0.
 */
async function main() {
  const full = process.argv.includes("full");
  const pass = full ? await runFullReplicationPass() : await runReplicationPollPass();

  const synced = pass.results.reduce((n, r) => n + r.rowsSynced, 0);
  const failed = pass.results.filter((r) => !r.ok);

  console.log(`${full ? "tier 2 (all tables)" : "tier 1 (tight)"}: ${pass.primary} -> ${pass.standby}`);
  console.log(`tables=${pass.results.length} rowsSynced=${synced} failed=${failed.length}`);

  for (const r of pass.results.filter((x) => x.rowsSynced > 0)) {
    console.log(`  +${r.rowsSynced} ${r.table}`);
  }
  for (const r of failed) {
    console.log(`  FAIL ${r.table}: ${r.error}`);
  }

  // Non-zero exit on failure so a scheduler or CI step notices.
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
