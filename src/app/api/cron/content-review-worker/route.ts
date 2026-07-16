import { NextResponse } from "next/server";
import { drainQueue } from "@/lib/contentReview/jobRunner";
import { queueStaleReviews } from "@/lib/contentReview/scheduledReReview";

const CRON_SECRET = process.env.CRON_SECRET;
const JOBS_PER_TICK = 3; // smaller than backup-sync's batch: each job here is several
// sequential LLM calls, not one DB copy.

/**
 * Called on a schedule by Vercel Cron (see vercel.json), same CRON_SECRET auth pattern as
 * src/app/api/cron/backup-sync/route.ts. Drains the content_review_jobs queue in small
 * batches — the only path that processes bulk-sweep jobs (single-item reviews are already
 * processed inline by POST /api/admin/review/jobs); also recovers any job left stale-claimed
 * by a killed/timed-out invocation. Also checks a small batch of already-reviewed content for
 * "Scheduled re-review" (Phase 3) — content edited since last review, or simply reviewed
 * long ago — and queues it; that queued work drains on this or a later tick, same as any
 * other job, not inline here.
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
    const processed = await drainQueue(JOBS_PER_TICK);
    const staleQueued = await queueStaleReviews();
    return NextResponse.json({ processed, staleQueued });
  } catch (e) {
    console.error("Content review worker (cron):", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Worker failed" }, { status: 500 });
  }
}
