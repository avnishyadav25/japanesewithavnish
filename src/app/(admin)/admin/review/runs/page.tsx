import Link from "next/link";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { REVIEW_ENTITY_TYPES } from "@/lib/contentReview/types";

type Row = {
  id: string;
  entity_type: string;
  entity_id: string;
  overall_status: string;
  overall_score: number | null;
  created_at: string;
  is_current: boolean;
  title: string | null;
};

export default async function ReviewRunsPage({
  searchParams,
}: {
  searchParams: Promise<{ content_type?: string; entity_id?: string }>;
}) {
  const sp = await searchParams;
  const contentTypeFilter = sp.content_type && (REVIEW_ENTITY_TYPES as readonly string[]).includes(sp.content_type) ? sp.content_type : null;
  const entityIdFilter = sp.entity_id || null;

  let items: Row[] = [];
  if (sql) {
    // Every run ever, not just each post's current one — this is the "versioned review
    // runs" history the entity detail page can't show (it only ever displays
    // posts.last_review_run_id, so a superseded run has no page of its own without this).
    const rows =
      contentTypeFilter && entityIdFilter
        ? await sql`
            SELECT r.id, r.entity_type, r.entity_id, r.overall_status, r.overall_score, r.created_at,
                   (r.id = p.last_review_run_id) AS is_current, p.title
            FROM content_review_runs r
            LEFT JOIN posts p ON p.id = r.entity_id
            WHERE r.entity_type = ${contentTypeFilter} AND r.entity_id = ${entityIdFilter}
            ORDER BY r.created_at DESC LIMIT 200
          `
        : contentTypeFilter
          ? await sql`
              SELECT r.id, r.entity_type, r.entity_id, r.overall_status, r.overall_score, r.created_at,
                     (r.id = p.last_review_run_id) AS is_current, p.title
              FROM content_review_runs r
              LEFT JOIN posts p ON p.id = r.entity_id
              WHERE r.entity_type = ${contentTypeFilter}
              ORDER BY r.created_at DESC LIMIT 200
            `
          : await sql`
              SELECT r.id, r.entity_type, r.entity_id, r.overall_status, r.overall_score, r.created_at,
                     (r.id = p.last_review_run_id) AS is_current, p.title
              FROM content_review_runs r
              LEFT JOIN posts p ON p.id = r.entity_id
              ORDER BY r.created_at DESC LIMIT 200
            `;
    items = rows as Row[];
  }

  return (
    <div>
      <AdminPageHeader title="AI Review Runs" breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Content Review", href: "/admin/review" }]} />

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="text-xs uppercase tracking-wider text-secondary mr-1">Type:</span>
        <Link href="/admin/review/runs" className={`px-2.5 py-1 rounded-bento text-xs font-medium transition ${!contentTypeFilter ? "bg-primary text-white" : "bg-base border border-[var(--divider)] text-secondary hover:border-primary"}`}>
          All
        </Link>
        {REVIEW_ENTITY_TYPES.map((t) => (
          <Link key={t} href={`/admin/review/runs?content_type=${t}`} className={`px-2.5 py-1 rounded-bento text-xs font-medium transition ${contentTypeFilter === t ? "bg-primary text-white" : "bg-base border border-[var(--divider)] text-secondary hover:border-primary"}`}>
            {t}
          </Link>
        ))}
      </div>

      {items.length > 0 ? (
        <AdminCard>
          <AdminTable headers={["Content", "Type", "Status", "Score", "Current?", "Date", "Actions"]}>
            {items.map((r) => (
              <tr key={r.id} className="border-b border-[var(--divider)]">
                <td className="py-2 px-2 font-medium text-charcoal">{r.title ?? r.entity_id}</td>
                <td className="py-2 px-2 text-secondary text-sm">{r.entity_type}</td>
                <td className="py-2 px-2">
                  <StatusBadge status={r.overall_status} />
                </td>
                <td className="py-2 px-2 text-charcoal">{r.overall_score ?? "—"}</td>
                <td className="py-2 px-2 text-sm">{r.is_current ? <span className="text-emerald-700">current</span> : <span className="text-secondary">superseded</span>}</td>
                <td className="py-2 px-2 text-secondary text-xs">{new Date(r.created_at).toLocaleString()}</td>
                <td className="py-2 px-2">
                  <Link href={`/admin/review/runs/${r.id}`} className="text-primary text-sm hover:underline">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      ) : (
        <AdminEmptyState message="No review runs yet." />
      )}
    </div>
  );
}
