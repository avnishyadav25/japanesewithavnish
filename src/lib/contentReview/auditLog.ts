import { sql } from "@/lib/db";

/** Gap-fix phase 20. Generic append-only audit event — used for admin actions that change a
 * post's review_state (Approve/Request Changes/Archive, single-item and bulk) which
 * otherwise had no actor/timestamp trail at all beyond a blind UPDATE. */
export async function logAuditEvent(params: {
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  if (!sql) return;
  await sql`
    INSERT INTO content_review_audit_log (actor, action, entity_type, entity_id, detail)
    VALUES (${params.actor}, ${params.action}, ${params.entityType}, ${params.entityId}, ${params.detail ? JSON.stringify(params.detail) : null}::jsonb)
  `;
}
