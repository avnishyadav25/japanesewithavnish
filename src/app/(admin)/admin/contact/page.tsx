import Link from "next/link";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";

type Row = {
  id: string;
  name: string;
  email: string;
  message: string;
  status: string;
  created_at: string;
};

export default async function AdminContactPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusFilter } = await searchParams;

  let items: Row[] = [];

  if (sql) {
    const filter = statusFilter && ["new", "read", "replied"].includes(statusFilter) ? statusFilter : null;
    const rows = filter
      ? await sql`
          SELECT id, name, email, message, status, created_at
          FROM contact_submissions WHERE status = ${filter}
          ORDER BY created_at DESC LIMIT 200
        `
      : await sql`
          SELECT id, name, email, message, status, created_at
          FROM contact_submissions ORDER BY created_at DESC LIMIT 200
        `;
    items = (rows ?? []) as Row[];
  }

  const newCount = items.filter((i) => i.status === "new").length;
  const statusVariant = (s: string) => (s === "new" ? "pending" : s === "replied" ? "published" : "draft");

  return (
    <div>
      <AdminPageHeader
        title="Contact submissions"
        breadcrumb={[{ label: "Admin", href: "/admin" }]}
      />
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="card-content bento-span-2 inline-block w-fit">
          <p className="text-secondary text-sm uppercase tracking-wider">Total</p>
          <p className="font-heading text-2xl font-bold text-charcoal">{items.length}</p>
        </div>
        {items.some((i) => i.status === "new") && (
          <div className="card-content bento-span-2 inline-block w-fit">
            <p className="text-secondary text-sm uppercase tracking-wider">Unread</p>
            <p className="font-heading text-2xl font-bold text-primary">{newCount}</p>
          </div>
        )}
        <div className="flex gap-2">
          {["all", "new", "read", "replied"].map((s) => (
            <Link
              key={s}
              href={s === "all" ? "/admin/contact" : `/admin/contact?status=${s}`}
              className={`px-3 py-1.5 rounded-bento text-sm font-medium transition ${
                (s === "all" && !statusFilter) || statusFilter === s
                  ? "bg-primary text-white"
                  : "bg-base border border-[var(--divider)] text-secondary hover:border-primary hover:text-primary"
              }`}
            >
              {s === "all" ? "All" : s}
            </Link>
          ))}
        </div>
      </div>
      {items.length > 0 ? (
        <AdminCard>
          <AdminTable headers={["Name", "Email", "Message", "Status", "Date", "Actions"]}>
            {items.map((c) => (
              <tr key={c.id} className="border-b border-[var(--divider)]">
                <td className="py-2 px-2 font-medium text-charcoal">{c.name}</td>
                <td className="py-2 px-2 text-secondary text-sm">
                  <a href={`mailto:${c.email}`} className="text-primary hover:underline">
                    {c.email}
                  </a>
                </td>
                <td className="py-2 px-2 text-charcoal max-w-[280px]">
                  <span className="line-clamp-2 block" title={c.message}>
                    {c.message}
                  </span>
                </td>
                <td className="py-2 px-2">
                  <StatusBadge status={c.status} variant={statusVariant(c.status)} />
                </td>
                <td className="py-2 px-2 text-secondary text-xs">
                  {new Date(c.created_at).toLocaleString()}
                </td>
                <td className="py-2 px-2">
                  <Link
                    href={`/admin/contact/${c.id}`}
                    className="text-primary text-sm hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      ) : (
        <AdminEmptyState message="No contact submissions yet." />
      )}
    </div>
  );
}
