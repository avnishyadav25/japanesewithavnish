import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { runBackupSyncBatch } from "@/lib/db-backup";
import { sql } from "@/lib/db";

/** Manual "Sync Now" trigger — processes one batch (a few tables) per call.
 * The admin page calls this repeatedly until status is "completed". */
export async function POST() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await runBackupSyncBatch(true);
    return NextResponse.json(result);
  } catch (e) {
    console.error("Backup sync (manual):", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sync failed" }, { status: 500 });
  }
}

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const stateRows = await sql`SELECT * FROM backup_sync_state WHERE id = 1`;
  const logRows = await sql`
    SELECT run_started_at, table_name, row_count, supabase_ok, turso_ok, r2_ok, error, synced_at
    FROM backup_sync_log
    ORDER BY synced_at DESC
    LIMIT 50
  `;

  return NextResponse.json({ state: stateRows[0] ?? null, recentLog: logRows });
}
