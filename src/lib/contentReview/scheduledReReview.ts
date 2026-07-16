import { sql } from "@/lib/db";
import { buildContentSnapshot, checksumSnapshot } from "./snapshot";
import { createJob } from "./jobRunner";
import type { ReviewEntityType } from "./types";

const CHECK_BATCH_SIZE = 20;
const STALE_REVIEW_DAYS = 90;

/** Phase 3 "Scheduled re-review." Checked once per cron tick (src/app/api/cron/
 * content-review-worker), after the normal queue drain — discovers work and queues it as a
 * bulk_sweep job; draining that job happens through the same queue mechanics as everything
 * else, not inline here. Two triggers:
 *  1. Content edited since its last review — detected via checksum, not posts.updated_at,
 *     since a sidecar-only edit (e.g. via Apply Fix) doesn't touch posts.updated_at at all.
 *  2. The last review is simply old (>90 days) — re-check even unchanged content
 *     periodically, since agent prompts/models may have improved since then.
 * Bounded to a small batch per tick (checksums require rebuilding the full snapshot) rather
 * than scanning every reviewed post every tick. */
export async function queueStaleReviews(): Promise<{ queuedForContentChange: number; queuedForAge: number }> {
  if (!sql) return { queuedForContentChange: 0, queuedForAge: 0 };

  const candidates = (await sql`
    SELECT p.id, p.content_type, r.id AS run_id, r.content_checksum, r.created_at AS run_created_at
    FROM posts p
    JOIN content_review_runs r ON r.id = p.last_review_run_id
    WHERE p.review_state IN ('approved', 'needs_human_review', 'published', 'changes_requested')
      AND NOT EXISTS (
        SELECT 1 FROM content_review_jobs j
        WHERE j.entity_id = p.id AND j.status IN ('queued', 'claimed', 'running')
      )
    ORDER BY r.created_at ASC
    LIMIT ${CHECK_BATCH_SIZE}
  `) as { id: string; content_type: string; run_id: string; content_checksum: string; run_created_at: string }[];

  let queuedForContentChange = 0;
  let queuedForAge = 0;

  for (const c of candidates) {
    const entityType = c.content_type as ReviewEntityType;
    const isStale = Date.now() - new Date(c.run_created_at).getTime() > STALE_REVIEW_DAYS * 24 * 60 * 60 * 1000;

    const snapshot = await buildContentSnapshot(entityType, c.id);
    if (!snapshot) continue; // content deleted or type mismatch since last review — skip
    const currentChecksum = checksumSnapshot(snapshot);
    const contentChanged = currentChecksum !== c.content_checksum;

    if (!contentChanged && !isStale) continue;

    const created = await createJob({ entityType, entityId: c.id, triggerType: "bulk_sweep", requestedBy: null });
    if ("id" in created) {
      if (contentChanged) queuedForContentChange++;
      else queuedForAge++;
    }
    // A 409 here just means something else already queued a job for this post between the
    // NOT EXISTS check above and this insert — fine, no action needed.
  }

  return { queuedForContentChange, queuedForAge };
}
