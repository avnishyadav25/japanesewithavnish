import { NextResponse } from "next/server";
import { runFullReplicationPass, runReplicationPollPass } from "@/lib/db/replication-poll";

export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

// This route used to loop internally for 45s, which was correct on Vercel (1-minute
// cron floor, 60s maxDuration) but is fatal on Netlify: functions are killed at ~10s,
// so every invocation died mid-pass and the response never came back. The loop budget
// is now env-tunable and defaults to something that fits inside Netlify's limit — the
// *caller* is responsible for repeating it (.github/workflows/crons.yml calls this
// several times per run; n8n on the VPS does the same at a tighter interval).
// Raise REPLICATION_POLL_BUDGET_MS only if the platform's function timeout allows it.
const LOOP_BUDGET_MS = Number(process.env.REPLICATION_POLL_BUDGET_MS ?? 7_000);
const PASS_INTERVAL_MS = Number(process.env.REPLICATION_POLL_PASS_INTERVAL_MS ?? 0);

// Tables per ?tier=full call. Each costs ~5 round trips to plan before any row moves, so
// this is sized to stay inside the same ~10s function budget the tight tier respects.
const FULL_TIER_TABLES_PER_CALL = Number(process.env.REPLICATION_FULL_TABLES_PER_CALL ?? 8);

/**
 * Runs replication passes (src/lib/db/replication-poll.ts) until the loop budget is
 * spent, then returns. With the default budget this is effectively one pass per call.
 *
 * ?tier=full runs one tier-2 pass over EVERY replicable table instead of just the tight
 * tier — called hourly, and always exactly one pass (a full pass touches ~137 tables and
 * would blow any loop budget). Without the param, behaviour is the tight tier as before.
 *
 * Auth: Authorization: Bearer $CRON_SECRET, or ?key=$CRON_SECRET.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const authHeader = req.headers.get("authorization");
  const bearerMatches = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
  if (!CRON_SECRET || (key !== CRON_SECRET && !bearerMatches)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (url.searchParams.get("tier") === "full") {
    // Resumable: planning a table costs several round trips before any row moves, so all
    // ~137 tables cannot fit in one serverless invocation. The caller loops on nextOffset
    // until done, exactly as it drains backup-sync.
    const offset = Number(url.searchParams.get("offset") ?? 0) || 0;
    const limit = Number(url.searchParams.get("limit") ?? FULL_TIER_TABLES_PER_CALL) || FULL_TIER_TABLES_PER_CALL;
    try {
      const pass = await runFullReplicationPass({ offset, limit });
      const failed = pass.results.filter((r) => !r.ok);
      return NextResponse.json({
        tier: "full",
        primary: pass.primary,
        standby: pass.standby,
        totalTables: pass.totalTables,
        tablesProcessed: pass.results.length,
        rowsSynced: pass.results.reduce((n, r) => n + r.rowsSynced, 0),
        nextOffset: pass.nextOffset,
        done: pass.done,
        failedCount: failed.length,
        failed,
      });
    } catch (e) {
      console.error("Replication poll (full tier):", e);
      return NextResponse.json({ error: e instanceof Error ? e.message : "Full replication pass failed" }, { status: 500 });
    }
  }

  const startedAt = Date.now();
  const passes: Awaited<ReturnType<typeof runReplicationPollPass>>[] = [];

  try {
    let lastPassMs = 0;
    do {
      const passStartedAt = Date.now();
      passes.push(await runReplicationPollPass());
      lastPassMs = Date.now() - passStartedAt;
      if (lastPassMs < PASS_INTERVAL_MS) {
        await new Promise((resolve) => setTimeout(resolve, PASS_INTERVAL_MS - lastPassMs));
      }
      // Only start another pass if the budget can plausibly absorb one the same size as
      // the last. Without this the loop reliably overruns by a whole pass and the platform
      // kills the request, losing the response (the cursor writes themselves are already
      // committed per-table, so no data is lost — but the caller sees a 502, not a result).
    } while (Date.now() - startedAt + lastPassMs < LOOP_BUDGET_MS);

    return NextResponse.json({ passesRun: passes.length, elapsedMs: Date.now() - startedAt, passes });
  } catch (e) {
    console.error("Replication poll (cron):", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Replication poll failed", passesRun: passes.length, passes }, { status: 500 });
  }
}
