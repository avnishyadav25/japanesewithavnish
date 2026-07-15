import { NextResponse } from "next/server";
import { runBackupSyncBatch } from "@/lib/db-backup";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Called hourly by Vercel Cron (see vercel.json), which sends the
 * Authorization: Bearer <CRON_SECRET> header automatically. Can also be pinged manually
 * with ?key=CRON_SECRET (e.g. from an external scheduler like n8n, if preferred instead).
 * Processes one batch of tables per call, resuming from backup_sync_state's cursor, until
 * the full database sync (Neon -> Supabase / Turso / R2) completes, then idles (20h
 * cooldown) until the next day's cycle starts naturally on a later hourly call.
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
