import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { sendNewsletterById } from "@/lib/newsletter";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Call from a cron job (e.g. Vercel cron or external scheduler) with ?key=CRON_SECRET.
 * Sends any draft newsletter whose send_at has passed.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const authHeader = req.headers.get("authorization");
  const bearerMatches = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
  if (CRON_SECRET && key !== CRON_SECRET && !bearerMatches) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!sql) {
    return NextResponse.json({ sent: 0, message: "Database unavailable" });
  }

  const dueRows = (await sql`
    SELECT id FROM newsletters WHERE status = 'draft' AND send_at IS NOT NULL AND send_at <= NOW()
  `) as { id: string }[];

  const results = [];
  for (const row of dueRows) {
    const result = await sendNewsletterById(row.id);
    results.push({ id: row.id, ...result });
  }

  return NextResponse.json({ processed: results.length, results });
}
