import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Read-only status endpoint for the backup sync, gated by CRON_SECRET rather than
 * admin session — lets a separate n8n workflow (Schedule Trigger -> HTTP Request ->
 * Google Sheets append) pull the summary without needing any Postgres/Supabase
 * credentials configured in n8n itself. n8n's role stays limited to calling HTTP
 * endpoints on a schedule.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const authHeader = req.headers.get("authorization");
  const bearerMatches = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
  if (CRON_SECRET && key !== CRON_SECRET && !bearerMatches) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const stateRows = await sql`SELECT * FROM backup_sync_state WHERE id = 1`;
  return NextResponse.json({ state: stateRows[0] ?? null, checked_at: new Date().toISOString() });
}
