import { sql } from "@/lib/db";
import { buildContentSnapshot, checksumSnapshot } from "./snapshot";
import { createJob } from "./jobRunner";
import type { ReviewEntityType } from "./types";

/** Gap-fix phase 8: event-driven re-review. Call (fire-and-forget-safe, never throws) from an
 * admin content-save route right after the write (and, for sidecar-backed types, after
 * syncPostToTypeTable()) completes. Only queues a job when this post already has a completed
 * review AND the content actually changed since that review — checksum-compared, the same
 * signal scheduledReReview.ts's 90-day sweep uses — so editing unrelated fields (sort_order, a
 * status-only toggle) doesn't spam a fresh AI review, and content that's never been reviewed
 * isn't auto-queued (that's what the explicit "Run Review" button is for). Enqueues only —
 * does not inline-drain — so a content save never blocks on the up-to-60s LLM chain; the next
 * cron tick picks it up exactly like a bulk_sweep job. */
export async function queueReReviewOnEdit(entityType: ReviewEntityType, entityId: string): Promise<void> {
  if (!sql) return;
  try {
    const rows = (await sql`
      SELECT r.content_checksum
      FROM posts p
      JOIN content_review_runs r ON r.id = p.last_review_run_id
      WHERE p.id = ${entityId}
        AND NOT EXISTS (
          SELECT 1 FROM content_review_jobs j
          WHERE j.entity_id = p.id AND j.status IN ('queued', 'claimed', 'running')
        )
    `) as { content_checksum: string }[];
    const lastChecksum = rows[0]?.content_checksum;
    if (!lastChecksum) return; // never reviewed, or a job's already active for it — nothing to do

    const snapshot = await buildContentSnapshot(entityType, entityId);
    if (!snapshot) return;
    if (checksumSnapshot(snapshot) === lastChecksum) return; // content didn't actually change

    await createJob({ entityType, entityId, triggerType: "content_edit", requestedBy: null });
    // A 409 here just means something else (another admin, the sweep) already queued a job
    // for this post in the moment between the NOT EXISTS check above and this insert — fine.
  } catch (err) {
    console.error("queueReReviewOnEdit failed (non-fatal, content save still succeeds):", err);
  }
}
