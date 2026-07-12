import Link from "next/link";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

type Row = { id: string; slug: string; title: string | null; subject: string; status: string; sent_at: string | null; created_at: string };

export default async function AdminNewslettersPage() {
  let newsletters: Row[] = [];
  if (sql) {
    try {
      const rows = await sql`
        SELECT id, slug, title, subject, status, sent_at, created_at
        FROM newsletters ORDER BY created_at DESC
      `;
      newsletters = (rows ?? []) as Row[];
    } catch {
      // Table may not exist yet
    }
  }

  if (newsletters.length === 0) {
    return (
      <div>
        <AdminPageHeader
          title="Newsletters"
          breadcrumb={[{ label: "Admin", href: "/admin" }]}
          action={{ label: "New newsletter", href: "/admin/newsletters/new" }}
        />
        <AdminEmptyState
          message="No newsletters yet."
          action={{ label: "New newsletter", href: "/admin/newsletters/new" }}
        />
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Newsletters"
        breadcrumb={[{ label: "Admin", href: "/admin" }]}
        action={{ label: "New newsletter", href: "/admin/newsletters/new" }}
      />
      <p className="text-sm text-secondary mb-4">
        <a href="/admin/ai-logs?entityType=newsletter" className="text-primary hover:underline">AI history</a>
      </p>
      <AdminCard>
        <AdminTable headers={["Subject", "Status", "Sent", "Actions"]}>
          {newsletters.map((n) => (
            <tr key={n.id} className="border-b border-[var(--divider)] hover:bg-[var(--base)] transition-colors">
              <td className="py-2 px-2 font-medium text-charcoal">{n.subject}</td>
              <td className="py-2 px-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${n.status === "sent" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-700"}`}>
                  {n.status === "sent" ? "Sent" : "Draft"}
                </span>
              </td>
              <td className="py-2 px-2 text-secondary text-xs">
                {n.sent_at ? new Date(n.sent_at).toLocaleString() : "—"}
              </td>
              <td className="py-2 px-2">
                <div className="flex gap-3">
                  <Link href={`/admin/newsletters/${n.id}/edit`} className="text-primary text-sm hover:underline">Edit</Link>
                  <a href={`/api/admin/newsletters/${n.id}/preview`} target="_blank" rel="noopener noreferrer" className="text-secondary text-sm hover:underline">Preview</a>
                </div>
              </td>
            </tr>
          ))}
        </AdminTable>
      </AdminCard>
    </div>
  );
}
