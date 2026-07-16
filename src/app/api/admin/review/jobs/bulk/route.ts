import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { isReviewEntityType } from "@/lib/contentReview/types";

const MAX_BULK_SIZE = 500;

/** Selects matching posts and queues one job each (ON CONFLICT DO NOTHING skips any post
 * that already has an active job, per the one-active-job-per-entity unique index) — then
 * returns immediately. Draining is cron-only (src/app/api/cron/content-review-worker), same
 * cursor-resume-per-tick idiom as backup-sync, not processed inline like the single-item path. */
export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const entityType = body?.entityType;
  const jlptLevel = typeof body?.jlptLevel === "string" ? body.jlptLevel : null;
  const reviewState = typeof body?.reviewState === "string" ? body.reviewState : "not_reviewed";

  if (typeof entityType !== "string" || !isReviewEntityType(entityType)) {
    return NextResponse.json({ error: "entityType is required" }, { status: 400 });
  }

  const candidates = jlptLevel
    ? await sql`
        SELECT id FROM posts
        WHERE content_type = ${entityType} AND review_state = ${reviewState} AND ${jlptLevel} = ANY(jlpt_level)
        LIMIT ${MAX_BULK_SIZE}
      `
    : await sql`
        SELECT id FROM posts
        WHERE content_type = ${entityType} AND review_state = ${reviewState}
        LIMIT ${MAX_BULK_SIZE}
      `;

  let queuedCount = 0;
  for (const row of candidates as { id: string }[]) {
    const inserted = await sql`
      INSERT INTO content_review_jobs (entity_type, entity_id, trigger_type, requested_by)
      VALUES (${entityType}, ${row.id}, 'bulk_sweep', ${admin.email})
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
    if (inserted[0]) {
      queuedCount++;
      await sql`UPDATE posts SET review_state = 'queued' WHERE id = ${row.id}`;
    }
  }

  return NextResponse.json({ queuedCount, candidateCount: candidates.length });
}
