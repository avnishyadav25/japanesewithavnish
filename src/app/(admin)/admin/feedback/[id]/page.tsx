import { notFound } from "next/navigation";
import Link from "next/link";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { FeedbackActions } from "./FeedbackActions";

type Row = {
  id: string;
  name: string | null;
  email: string | null;
  message: string;
  status: string;
  created_at: string;
};

export default async function AdminFeedbackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!sql) notFound();

  const rows = await sql`
    SELECT id, name, email, message, status, created_at
    FROM feedback WHERE id = ${id} LIMIT 1
  `;
  const item = (rows[0] ?? null) as Row | null;
  if (!item) notFound();

  const statusVariant = item.status === "new" ? "pending" : item.status === "replied" ? "published" : "draft";

  return (
    <div>
      <AdminPageHeader
        title="Feedback"
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Feedback", href: "/admin/feedback" },
          { label: item.name || "Anonymous", href: `/admin/feedback/${id}` },
        ]}
      />
      <AdminCard>
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="font-heading text-xl font-bold text-charcoal mb-1">{item.name || "Anonymous"}</h2>
            {item.email && (
              <a href={`mailto:${item.email}`} className="text-primary hover:underline text-sm">
                {item.email}
              </a>
            )}
            <p className="text-secondary text-xs mt-2">{new Date(item.created_at).toLocaleString()}</p>
          </div>
          <StatusBadge status={item.status} variant={statusVariant} />
        </div>
        <div className="border-t border-[var(--divider)] pt-4 mb-6">
          <h3 className="font-heading font-semibold text-charcoal mb-2">Message</h3>
          <div className="text-secondary text-sm whitespace-pre-wrap bg-base/50 rounded-bento p-4">
            {item.message}
          </div>
        </div>
        <FeedbackActions id={id} status={item.status} hasEmail={Boolean(item.email)} />
        <div className="mt-6 pt-4 border-t border-[var(--divider)]">
          <Link href="/admin/feedback" className="text-primary text-sm hover:underline">
            ← Back to list
          </Link>
        </div>
      </AdminCard>
    </div>
  );
}
