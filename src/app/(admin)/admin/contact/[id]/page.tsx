import { notFound } from "next/navigation";
import Link from "next/link";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ContactSubmissionActions } from "./ContactSubmissionActions";

type Row = {
  id: string;
  name: string;
  email: string;
  message: string;
  status: string;
  created_at: string;
};

export default async function AdminContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!sql) notFound();

  const rows = await sql`
    SELECT id, name, email, message, status, created_at
    FROM contact_submissions WHERE id = ${id} LIMIT 1
  `;
  const submission = (rows[0] ?? null) as Row | null;
  if (!submission) notFound();

  const statusVariant =
    submission.status === "new" ? "pending" : submission.status === "replied" ? "published" : "draft";

  return (
    <div>
      <AdminPageHeader
        title="Contact submission"
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Contact", href: "/admin/contact" },
          { label: submission.name, href: `/admin/contact/${id}` },
        ]}
      />
      <AdminCard>
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="font-heading text-xl font-bold text-charcoal mb-1">{submission.name}</h2>
            <a
              href={`mailto:${submission.email}`}
              className="text-primary hover:underline text-sm"
            >
              {submission.email}
            </a>
            <p className="text-secondary text-xs mt-2">
              {new Date(submission.created_at).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={submission.status} variant={statusVariant} />
            <ContactSubmissionActions id={id} status={submission.status} />
          </div>
        </div>
        <div className="border-t border-[var(--divider)] pt-4">
          <h3 className="font-heading font-semibold text-charcoal mb-2">Message</h3>
          <div className="text-secondary text-sm whitespace-pre-wrap bg-base/50 rounded-bento p-4">
            {submission.message}
          </div>
        </div>
        <div className="mt-6 pt-4 border-t border-[var(--divider)]">
          <Link href="/admin/contact" className="text-primary text-sm hover:underline">
            ← Back to list
          </Link>
        </div>
      </AdminCard>
    </div>
  );
}
