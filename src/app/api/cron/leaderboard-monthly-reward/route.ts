import { NextResponse } from "next/server";
import { runMonthlyLeaderboardReward } from "@/lib/leaderboard-rewards";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Call from a cron job on the 1st of each month (e.g. Vercel cron) with ?key=CRON_SECRET
 * (or the Authorization: Bearer <CRON_SECRET> header Vercel injects automatically).
 * Ranks last month's XP leaderboard, records the top 3, and grants rewards per the
 * admin-configured mode. Idempotent — re-running for an already-processed month is a no-op.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const authHeader = req.headers.get("authorization");
  const bearerMatches = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
  if (CRON_SECRET && key !== CRON_SECRET && !bearerMatches) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runMonthlyLeaderboardReward();
  return NextResponse.json(result);
}
