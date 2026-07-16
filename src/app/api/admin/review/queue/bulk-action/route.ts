import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { createJob } from "@/lib/contentReview/jobRunner";
import { getPublishGateStatus } from "@/lib/contentReview/publishGate";
import { logAuditEvent } from "@/lib/contentReview/auditLog";
import type { ReviewEntityType } from "@/lib/contentReview/types";

const VALID_ACTIONS = ["approve", "request_changes", "archive", "run_review", "mark_false_positive"];
const MAX_BULK_SIZE = 100;

/** Queue-table bulk actions (checkbox multi-select), per the spec's Review Queue bulk-action
 * list. Approve/request_changes/archive act on posts.review_state; run_review queues a job
 * per post; mark_false_positive marks every currently-open finding on each post's latest run.
 * "Do not allow bulk approval for content containing critical findings" is enforced via the
 * same getPublishGateStatus() check the publish gate uses — a post with open criticals is
 * skipped, not silently approved. */
export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const action = body?.action;
  const items: { entityType: string; entityId: string }[] = Array.isArray(body?.items) ? body.items.slice(0, MAX_BULK_SIZE) : [];

  if (typeof action !== "string" || !VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  if (items.length === 0) return NextResponse.json({ error: "No items selected" }, { status: 400 });

  let succeeded = 0;
  const skipped: string[] = [];

  for (const item of items) {
    if (action === "approve") {
      const gate = await getPublishGateStatus(item.entityId);
      const hasOpenCritical = gate.openCriticalFindings.length > 0;
      if (hasOpenCritical) {
        skipped.push(`${item.entityId}: has open critical findings`);
        continue;
      }
      await sql`UPDATE posts SET review_state = 'approved' WHERE id = ${item.entityId}`;
      await logAuditEvent({ actor: admin.email, action: "approve", entityType: item.entityType, entityId: item.entityId, detail: { source: "bulk" } });
      succeeded++;
    } else if (action === "request_changes") {
      await sql`UPDATE posts SET review_state = 'changes_requested' WHERE id = ${item.entityId}`;
      await logAuditEvent({ actor: admin.email, action: "request_changes", entityType: item.entityType, entityId: item.entityId, detail: { source: "bulk" } });
      succeeded++;
    } else if (action === "archive") {
      await sql`UPDATE posts SET review_state = 'archived' WHERE id = ${item.entityId}`;
      await logAuditEvent({ actor: admin.email, action: "archive", entityType: item.entityType, entityId: item.entityId, detail: { source: "bulk" } });
      succeeded++;
    } else if (action === "run_review") {
      const created = await createJob({
        entityType: item.entityType as ReviewEntityType,
        entityId: item.entityId,
        triggerType: "bulk_sweep",
        requestedBy: admin.email,
      });
      if ("id" in created) succeeded++;
      else skipped.push(`${item.entityId}: ${created.error}`);
    } else if (action === "mark_false_positive") {
      const rows = await sql`
        SELECT f.id FROM posts p
        JOIN content_review_findings f ON f.review_run_id = p.last_review_run_id
        WHERE p.id = ${item.entityId} AND f.status = 'open'
      `;
      for (const row of rows as { id: string }[]) {
        await sql`UPDATE content_review_findings SET status = 'false_positive' WHERE id = ${row.id}`;
        await sql`
          INSERT INTO content_review_decisions (finding_id, decision, decision_note, decided_by)
          VALUES (${row.id}, 'false_positive', 'Bulk action from Review Queue', ${admin.email})
        `;
      }
      succeeded++;
    }
  }

  return NextResponse.json({ succeeded, skipped });
}
