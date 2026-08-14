import { NextResponse } from "next/server";
import { runSheetsExport, sheetsExportConfigured } from "@/lib/google-sheets-export";

const CRON_SECRET = process.env.CRON_SECRET;

/** Called every 30 minutes by .github/workflows/crons.yml. Incremental — only exports
 * orders/leaderboard changes since the last run (src/lib/google-sheets-export.ts). Not
 * part of the live-replication path; Sheets is a reporting export only. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const authHeader = req.headers.get("authorization");
  const bearerMatches = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
  if (!CRON_SECRET || (key !== CRON_SECRET && !bearerMatches)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!sheetsExportConfigured()) {
    return NextResponse.json({ status: "not_configured" });
  }

  try {
    const result = await runSheetsExport();
    return NextResponse.json({ status: "ok", ...result });
  } catch (e) {
    console.error("Sheets export (cron):", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sheets export failed" }, { status: 500 });
  }
}
