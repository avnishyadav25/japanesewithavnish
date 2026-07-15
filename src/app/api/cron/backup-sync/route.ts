import { NextResponse } from "next/server";
import { runBackupSyncBatch } from "@/lib/db-backup";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Call on a schedule (n8n Schedule Trigger -> HTTP Request, every few minutes) with
 * ?key=CRON_SECRET (or the Authorization: Bearer <CRON_SECRET> header). Processes one
 * batch of tables per call, resuming from backup_sync_state's cursor, until the full
 * database sync (Neon -> Supabase / Turso / R2) completes, then idles until the next
 * run naturally starts on the following call after completion.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const authHeader = req.headers.get("authorization");
  const bearerMatches = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
  if (CRON_SECRET && key !== CRON_SECRET && !bearerMatches) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runBackupSyncBatch();
    return NextResponse.json(result);
  } catch (e) {
    console.error("Backup sync (cron):", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sync failed" }, { status: 500 });
  }
}
