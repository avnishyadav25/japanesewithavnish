import Link from "next/link";
import { sql } from "@/lib/db";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";

type NewsletterRow = {
  id: string;
  subject: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  sent_count?: number;
  failed_count?: number;
  skipped_count?: number;
};

export default async function AdminNewsletterNotificationsPage() {
  let newsletters: NewsletterRow[] = [];
  let metrics = { drafts: 0, sent: 0, subscribers: 0, failed_30d: 0 };

  if (sql) {
    try {
      const newsletterRows = await sql`
        SELECT id, subject, status, sent_at, created_at
        FROM newsletters
        ORDER BY created_at DESC
        LIMIT 100
      ` as NewsletterRow[];
      const metricRows = await sql`
        SELECT
          (SELECT COUNT(*)::int FROM newsletters WHERE status = 'draft') AS drafts,
          (SELECT COUNT(*)::int FROM newsletters WHERE status = 'sent') AS sent,
          (SELECT COUNT(*)::int FROM subscribers) AS subscribers,
          0::int AS failed_30d
      ` as typeof metrics[];
      newsletters = newsletterRows ?? [];
      metrics = metricRows[0] ?? metrics;
    } catch (error) {
      console.error("Admin newsletter notifications:", error);
    }
    try {
      const logRows = await sql`
        SELECT newsletter_id,
          COUNT(*) FILTER (WHERE status = 'sent')::int AS sent_count,
          COUNT(*) FILTER (WHERE status = 'failed')::int AS failed_count,
          COUNT(*) FILTER (WHERE status = 'skipped')::int AS skipped_count
        FROM newsletter_send_logs
        GROUP BY newsletter_id
      ` as { newsletter_id: string; sent_count: number; failed_count: number; skipped_count: number }[];
      const failedRows = await sql`
        SELECT COUNT(*)::int AS failed_30d
        FROM newsletter_send_logs
        WHERE status = 'failed' AND sent_at >= NOW() - INTERVAL '30 days'
      ` as { failed_30d: number }[];
      const byId = new Map(logRows.map((row) => [row.newsletter_id, row]));
      newsletters = newsletters.map((newsletter) => ({ ...newsletter, ...(byId.get(newsletter.id) || {}) }));
      metrics.failed_30d = Number(failedRows[0]?.failed_30d ?? 0);
    } catch {
      // Migration 065 adds newsletter_send_logs. Until it is applied, show newsletter status without delivery aggregates.
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Newsletter Notifications"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Newsletter" }]}
        actions={[
          { label: "Subscribers", href: "/admin/newsletter/subscribers" },
          { label: "Create Newsletter", href: "/admin/newsletters/new" },
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <AdminCard><p className="text-xs uppercase tracking-wider text-secondary">Drafts</p><p className="font-heading text-3xl font-bold">{Number(metrics.drafts)}</p></AdminCard>
        <AdminCard><p className="text-xs uppercase tracking-wider text-secondary">Sent newsletters</p><p className="font-heading text-3xl font-bold">{Number(metrics.sent)}</p></AdminCard>
        <AdminCard><p className="text-xs uppercase tracking-wider text-secondary">Subscribers</p><p className="font-heading text-3xl font-bold">{Number(metrics.subscribers)}</p></AdminCard>
        <AdminCard><p className="text-xs uppercase tracking-wider text-secondary">Failed 30d</p><p className="font-heading text-3xl font-bold">{Number(metrics.failed_30d)}</p></AdminCard>
      </div>

      <AdminCard>
        <h2 className="font-heading text-lg font-semibold mb-4">Newsletter Delivery History</h2>
        {newsletters.length ? (
          <AdminTable headers={["Subject", "Status", "Sent at", "Sent", "Failed", "Skipped", "Actions"]}>
            {newsletters.map((newsletter) => (
              <tr key={newsletter.id} className="border-b border-[var(--divider)]">
                <td className="py-2 px-2 font-medium">{newsletter.subject}</td>
                <td className="py-2 px-2">{newsletter.status}</td>
                <td className="py-2 px-2 text-secondary">{newsletter.sent_at ? new Date(newsletter.sent_at).toLocaleString() : "-"}</td>
                <td className="py-2 px-2">{Number(newsletter.sent_count ?? 0)}</td>
                <td className="py-2 px-2">{Number(newsletter.failed_count ?? 0)}</td>
                <td className="py-2 px-2">{Number(newsletter.skipped_count ?? 0)}</td>
                <td className="py-2 px-2">
                  <div className="flex gap-3">
                    <Link href={`/admin/newsletters/${newsletter.id}/edit`} className="text-primary hover:underline">Edit</Link>
                    <a href={`/api/admin/newsletters/${newsletter.id}/preview`} target="_blank" rel="noopener noreferrer" className="text-secondary hover:underline">Preview</a>
                  </div>
                </td>
              </tr>
            ))}
          </AdminTable>
        ) : (
          <AdminEmptyState message="No newsletters or delivery logs yet." action={{ label: "Create newsletter", href: "/admin/newsletters/new" }} />
        )}
      </AdminCard>
    </div>
  );
}
