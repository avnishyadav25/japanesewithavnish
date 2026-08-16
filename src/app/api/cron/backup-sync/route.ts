import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Status endpoint, NOT a worker any more.
 *
 * This route used to call runBackupSyncBatch(). It cannot: writeToTurso() sends 200 rows per
 * HTTP round trip, so content_events (5,332 rows) alone needs 27 sequential calls to Turso
 * plus a 3.7MB R2 upload, against a ~30s function ceiling. Eight tables exceed 2,000 rows and
 * the largest is 11,550 — no batch size makes that fit.
 *
 * It appeared to work for months only because TURSO_DB_URL was unset in Netlify: every Turso
 * write failed instantly, batches were fast, and the job reported "completed" nightly having
 * archived nothing to Turso. Setting the credentials on 2026-08-16 made the writes real and
 * the job deadlocked within one batch — it reprocessed the same three tables 27 times while
 * next_table_offset stayed at 5.
 *
 * Archiving now runs in .github/workflows/backup-sync.yml, which has no timeout. Reporting
 * status here keeps the schedule useful without pretending to do work it cannot finish.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const authHeader = req.headers.get("authorization");
  const bearerMatches = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
  if (!CRON_SECRET || (key !== CRON_SECRET && !bearerMatches)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const stateRows = (await sql`SELECT * FROM backup_sync_state WHERE id = 1`) as {
      status: string;
      run_completed_at: string | null;
      total_tables: number;
      next_table_offset: number;
      tables_synced_ok: number;
      tables_synced_failed: number;
    }[];
    const state = stateRows[0] ?? null;

    const ageHours = state?.run_completed_at
      ? Math.round((Date.now() - new Date(state.run_completed_at).getTime()) / 3_600_000)
      : null;

    // A backup that quietly stopped being produced looks identical to a healthy one until
    // somebody checks the date, so say it plainly rather than leaving it to be inferred.
    const stale = ageHours === null || ageHours > 48;

    return NextResponse.json({
      note: "Archiving runs in .github/workflows/backup-sync.yml — the job exceeds this platform's function timeout.",
      state,
      lastCompletedHoursAgo: ageHours,
      stale,
    });
  } catch (e) {
    console.error("Backup status (cron):", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Status failed" }, { status: 500 });
  }
}
