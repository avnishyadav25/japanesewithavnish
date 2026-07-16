import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { checkUnchangedSinceLastReview, createJob, drainQueue } from "@/lib/contentReview/jobRunner";
import { isReviewEntityType, AGENT_KEYS, type AgentKey } from "@/lib/contentReview/types";

// First route in this codebase to set maxDuration: a single-item review runs up to 6
// sequential DeepSeek calls; 60s is a conservative ceiling for that inline-awaited path.
export const maxDuration = 60;

export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const entityType = body?.entityType;
  const entityId = body?.entityId;
  const requestedAgentKeys: AgentKey[] | undefined = Array.isArray(body?.requestedAgentKeys)
    ? body.requestedAgentKeys.filter((k: string) => (AGENT_KEYS as readonly string[]).includes(k))
    : undefined;

  if (typeof entityType !== "string" || !isReviewEntityType(entityType) || typeof entityId !== "string" || !entityId) {
    return NextResponse.json({ error: "entityType and entityId are required" }, { status: 400 });
  }

  const force = body?.force === true;
  if (!force) {
    const unchangedCheck = await checkUnchangedSinceLastReview(entityType, entityId);
    if (unchangedCheck.unchanged && unchangedCheck.existingRun) {
      return NextResponse.json({ skipped: true, reason: "unchanged", run: unchangedCheck.existingRun });
    }
  }

  const created = await createJob({
    entityType,
    entityId,
    triggerType: "manual_single",
    requestedBy: admin.email,
    requestedAgentKeys: requestedAgentKeys ?? null,
  });
  if ("error" in created) return NextResponse.json({ error: created.error }, { status: created.status });

  // Inline-await the same claim+run path the cron uses — real queue architecture (job row,
  // atomic claim, retry bookkeeping), instant-feeling UX for the common single-item case.
  await drainQueue(1);

  if (!sql) return NextResponse.json({ id: created.id });
  const rows = await sql`SELECT id, status, error_message FROM content_review_jobs WHERE id = ${created.id}`;
  return NextResponse.json({ id: created.id, job: rows[0] ?? null });
}

const ALL_JOB_STATUSES = ["queued", "claimed", "running", "completed", "failed"];

export async function GET(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status"); // comma-separated
  const triggerType = url.searchParams.get("trigger_type");

  const statuses = statusParam ? statusParam.split(",").map((s) => s.trim()).filter(Boolean) : ALL_JOB_STATUSES;

  const rows = triggerType
    ? await sql`
        SELECT id, entity_type, entity_id, trigger_type, status, attempt_count, max_attempts,
               error_message, requested_by, created_at, started_at, completed_at
        FROM content_review_jobs
        WHERE status = ANY(${statuses}) AND trigger_type = ${triggerType}
        ORDER BY created_at DESC
        LIMIT 200
      `
    : await sql`
        SELECT id, entity_type, entity_id, trigger_type, status, attempt_count, max_attempts,
               error_message, requested_by, created_at, started_at, completed_at
        FROM content_review_jobs
        WHERE status = ANY(${statuses})
        ORDER BY created_at DESC
        LIMIT 200
      `;
  return NextResponse.json({ jobs: rows });
}
