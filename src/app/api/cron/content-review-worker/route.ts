import { NextResponse } from "next/server";
import { reapExhaustedJobs } from "@/lib/contentReview/jobRunner";
import { queueStaleReviews } from "@/lib/contentReview/scheduledReReview";
import { sql } from "@/lib/db";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Queue maintenance and health, NOT a worker any more.
 *
 * This route used to call drainQueue(3), and returned HTTP 502 on every single invocation.
 * Review jobs make ~7 sequential DeepSeek calls each — measured p90 64s, max 82s — against a
 * Netlify function ceiling of ~30s (an 18.4s request returns 200; the 502 arrived at exactly
 * 30.55s). One job could not finish here, let alone three.
 *
 * Draining now happens in .github/workflows/content-review.yml, which has no such limit, the
 * same way video renders moved to video-render.yml for the same reason.
 *
 * What stays here is the cheap part: queueing scheduled re-reviews, reaping jobs that can
 * never succeed again, and reporting queue depth so the schedule still produces a signal.
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
    const reaped = await reapExhaustedJobs();
    const staleQueued = await queueStaleReviews();

    const rows = (await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'queued')::int              AS queued,
        COUNT(*) FILTER (WHERE status IN ('claimed','running'))::int AS running,
        COUNT(*) FILTER (WHERE status = 'failed')::int              AS failed,
        COUNT(*) FILTER (WHERE status = 'completed')::int           AS completed
      FROM content_review_jobs
    `) as { queued: number; running: number; failed: number; completed: number }[];

    return NextResponse.json({
      note: "Draining runs in .github/workflows/content-review.yml — jobs exceed this platform's function timeout.",
      reaped,
      staleQueued,
      queue: rows[0] ?? null,
    });
  } catch (e) {
    console.error("Content review maintenance (cron):", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Maintenance failed" }, { status: 500 });
  }
}
