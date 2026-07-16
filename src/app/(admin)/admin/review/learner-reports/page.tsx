import Link from "next/link";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { LearnerReportRow } from "./LearnerReportRow";

type Row = {
  id: string;
  entity_type: string;
  entity_id: string;
  category: string;
  message: string | null;
  reporter_email: string | null;
  status: string;
  created_at: string;
  title: string | null;
  slug: string | null;
};

export default async function LearnerReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusFilter } = await searchParams;
  const filter = statusFilter && ["new", "triaged", "resolved", "dismissed"].includes(statusFilter) ? statusFilter : null;

  let items: Row[] = [];
  if (sql) {
    const rows = filter
      ? await sql`
          SELECT r.id, r.entity_type, r.entity_id, r.category, r.message, r.reporter_email, r.status, r.created_at,
                 p.title, p.slug
          FROM learner_content_reports r
          LEFT JOIN posts p ON p.id = r.entity_id
          WHERE r.status = ${filter}
          ORDER BY r.created_at DESC LIMIT 200
        `
      : await sql`
          SELECT r.id, r.entity_type, r.entity_id, r.category, r.message, r.reporter_email, r.status, r.created_at,
                 p.title, p.slug
          FROM learner_content_reports r
          LEFT JOIN posts p ON p.id = r.entity_id
          ORDER BY r.created_at DESC LIMIT 200
        `;
    items = rows as Row[];
  }

  return (
    <div>
      <AdminPageHeader
        title="Learner Reports"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Content Review", href: "/admin/review" }]}
      />
      <div className="flex gap-2 mb-6">
        {["all", "new", "triaged", "resolved", "dismissed"].map((s) => (
          <Link
            key={s}
            href={s === "all" ? "/admin/review/learner-reports" : `/admin/review/learner-reports?status=${s}`}
            className={`px-3 py-1.5 rounded-bento text-sm font-medium transition ${
              (s === "all" && !filter) || filter === s
                ? "bg-primary text-white"
                : "bg-base border border-[var(--divider)] text-secondary hover:border-primary hover:text-primary"
            }`}
          >
            {s === "all" ? "All" : s}
          </Link>
        ))}
      </div>

      {items.length > 0 ? (
        <AdminCard>
          <AdminTable headers={["Content", "Category", "Message", "Reporter", "Status", "Date", "Actions"]}>
            {items.map((r) => (
              <tr key={r.id} className="border-b border-[var(--divider)]">
                <td className="py-2 px-2 font-medium text-charcoal max-w-[200px]">
                  <Link href={`/admin/review/${r.entity_type}/${r.entity_id}`} className="hover:underline">
                    <span className="line-clamp-1 block">{r.title ?? r.entity_id}</span>
                  </Link>
                </td>
                <td className="py-2 px-2 text-secondary text-sm">{r.category}</td>
                <td className="py-2 px-2 text-charcoal text-sm max-w-[240px]">
                  <span className="line-clamp-2 block">{r.message || "—"}</span>
                </td>
                <td className="py-2 px-2 text-secondary text-xs">{r.reporter_email || "anonymous"}</td>
                <td className="py-2 px-2">
                  <StatusBadge status={r.status} variant={r.status === "new" ? "pending" : r.status === "resolved" ? "published" : "draft"} />
                </td>
                <td className="py-2 px-2 text-secondary text-xs">{new Date(r.created_at).toLocaleString()}</td>
                <td className="py-2 px-2">
                  <LearnerReportRow id={r.id} />
                </td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      ) : (
        <AdminEmptyState message="No learner reports yet." />
      )}
    </div>
  );
}
