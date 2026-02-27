import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

export default async function AdminNewsletterSubscribersPage() {
  const supabase = createAdminClient();
  const [
    { count: total },
    { data: subscribers },
  ] = await Promise.all([
    supabase.from("subscribers").select("id", { count: "exact", head: true }),
    supabase
      .from("subscribers")
      .select("email, name, source, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const csv = subscribers
    ? "email,name,source,created_at\n" +
      subscribers.map((s) => `${s.email},${s.name || ""},${s.source || ""},${s.created_at}`).join("\n")
    : "email,name,source,created_at\n";

  return (
    <div>
      <AdminPageHeader
        title="Newsletter Subscribers"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Newsletter" }]}
      />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="card-content bento-span-2 inline-block w-fit">
          <p className="text-secondary text-sm uppercase tracking-wider">Total</p>
          <p className="font-heading text-2xl font-bold text-charcoal">{total ?? 0}</p>
        </div>
        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`}
          download="subscribers.csv"
          className="btn-primary inline-block"
        >
          Export CSV
        </a>
      </div>
      {subscribers && subscribers.length > 0 ? (
        <AdminCard>
          <AdminTable headers={["Email", "Name", "Source", "Date"]}>
            {subscribers.map((s, i) => (
              <tr key={i} className="border-b border-[var(--divider)]">
                <td className="py-2 px-2">{s.email}</td>
                <td className="py-2 px-2 text-secondary">{s.name || "—"}</td>
                <td className="py-2 px-2 text-secondary">{s.source || "—"}</td>
                <td className="py-2 px-2 text-secondary text-xs">
                  {new Date(s.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      ) : (
        <AdminEmptyState message="No subscribers yet." />
      )}
    </div>
  );
}
