import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

type LogRow = {
  created_at: string;
  actor: string;
  action: string;
  label: string;
  detail: string | null;
};

/** Gap-fix phase 20. Unions the three sources of actor+timestamp-tracked review-system
 * events into one chronological feed: content_review_audit_log (post review_state changes —
 * migration 115), content_review_decisions (finding-level Accept/Reject/Mark Fixed/False
 * Positive), and review_agent_versions (agent config/prompt changes — migration 114/Phase
 * 18). Read-only — this page doesn't take any actions itself. */
export default async function AuditLogPage() {
  let rows: LogRow[] = [];

  if (sql) {
    rows = (await sql`
      SELECT l.created_at::text AS created_at, l.actor, l.action,
             COALESCE(p.title, l.entity_type || ' ' || l.entity_id::text) AS label,
             l.detail::text AS detail
      FROM content_review_audit_log l
      LEFT JOIN posts p ON p.id = l.entity_id
      UNION ALL
      SELECT d.decided_at::text AS created_at, d.decided_by AS actor, d.decision AS action,
             COALESCE(p.title, f.title) AS label,
             d.decision_note AS detail
      FROM content_review_decisions d
      JOIN content_review_findings f ON f.id = d.finding_id
      LEFT JOIN content_review_runs r ON r.id = f.review_run_id
      LEFT JOIN posts p ON p.id = r.entity_id
      UNION ALL
      SELECT v.created_at::text AS created_at, COALESCE(v.changed_by, 'system') AS actor, 'agent_config_change' AS action,
             a.name AS label,
             ('model=' || v.model_name || ', temp=' || v.temperature::text || ', enabled=' || v.is_enabled::text) AS detail
      FROM review_agent_versions v
      JOIN content_review_agents a ON a.agent_key = v.agent_key
      ORDER BY created_at DESC
      LIMIT 300
    `) as LogRow[];
  }

  return (
    <div>
      <AdminPageHeader title="Audit Log" breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Content Review", href: "/admin/review" }]} />
      <p className="text-sm text-secondary mb-4">
        Every actor-tracked action in the Content Review Center: post approve/request-changes/archive decisions,
        finding-level decisions, and agent configuration/prompt changes.
      </p>
      {rows.length > 0 ? (
        <AdminCard>
          <AdminTable headers={["When", "Actor", "Action", "On", "Detail"]}>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-[var(--divider)]">
                <td className="py-2 px-2 text-xs text-secondary whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                <td className="py-2 px-2 text-xs text-charcoal">{r.actor}</td>
                <td className="py-2 px-2 text-xs text-secondary uppercase tracking-wider">{r.action.replace(/_/g, " ")}</td>
                <td className="py-2 px-2 text-sm text-charcoal max-w-[220px] truncate" title={r.label}>
                  {r.label}
                </td>
                <td className="py-2 px-2 text-xs text-secondary max-w-xs truncate" title={r.detail ?? undefined}>
                  {r.detail ?? "—"}
                </td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      ) : (
        <AdminEmptyState message="No audited actions recorded yet." />
      )}
    </div>
  );
}
