import { NextResponse } from "next/server";
import { runReplicationPollPass } from "@/lib/db/replication-poll";

export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;
const LOOP_BUDGET_MS = 45_000;
const PASS_INTERVAL_MS = 12_000;

/**
 * Called every minute by Vercel Cron (see vercel.json) — Vercel Cron's floor is 1
 * minute, so this loops internally every ~12s for up to ~45s per invocation (leaving
 * headroom under maxDuration) to give effective sub-minute sync coverage for the
 * tight-replication table tier (src/lib/db/replication-poll.ts).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const authHeader = req.headers.get("authorization");
  const bearerMatches = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
  if (CRON_SECRET && key !== CRON_SECRET && !bearerMatches) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  const passes: Awaited<ReturnType<typeof runReplicationPollPass>>[] = [];

  try {
    while (Date.now() - startedAt < LOOP_BUDGET_MS) {
      const passStartedAt = Date.now();
      passes.push(await runReplicationPollPass());
      const elapsed = Date.now() - passStartedAt;
      if (elapsed < PASS_INTERVAL_MS) {
        await new Promise((resolve) => setTimeout(resolve, PASS_INTERVAL_MS - elapsed));
      }
    }
    return NextResponse.json({ passesRun: passes.length, passes });
  } catch (e) {
    console.error("Replication poll (cron):", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Replication poll failed", passesRun: passes.length, passes }, { status: 500 });
  }
}
