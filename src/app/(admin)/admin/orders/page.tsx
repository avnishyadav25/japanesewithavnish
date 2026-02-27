import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const supabase = createAdminClient();
  let query = supabase
    .from("orders")
    .select("id, user_email, status, total_amount_paise, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data: orders } = await query;

  const statusVariant = (s: string) =>
    s === "paid" ? "paid" : s === "pending_payment" || s === "created" ? "pending" : s === "failed" ? "failed" : "created";

  return (
    <div>
      <AdminPageHeader title="Orders" breadcrumb={[{ label: "Admin", href: "/admin" }]} />
      <div className="flex gap-2 mb-6">
        {["all", "paid", "pending_payment", "created", "failed"].map((s) => (
          <Link
            key={s}
            href={s === "all" ? "/admin/orders" : `/admin/orders?status=${s}`}
            className={`px-3 py-1.5 rounded-bento text-sm font-medium transition ${
              (s === "all" && !status) || status === s
                ? "bg-primary text-white"
                : "bg-base border border-[var(--divider)] text-secondary hover:border-primary hover:text-primary"
            }`}
          >
            {s === "all" ? "All" : s.replace("_", " ")}
          </Link>
        ))}
      </div>
      {orders && orders.length > 0 ? (
        <AdminCard>
          <AdminTable headers={["Order", "Email", "Status", "Amount", "Date"]}>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-[var(--divider)]">
                <td className="py-2 px-2 font-mono text-xs">{o.id.slice(0, 8)}</td>
                <td className="py-2 px-2">{o.user_email}</td>
                <td className="py-2 px-2">
                  <StatusBadge status={o.status} variant={statusVariant(o.status)} />
                </td>
                <td className="py-2 px-2">₹{o.total_amount_paise / 100}</td>
                <td className="py-2 px-2 text-secondary text-xs">
                  {new Date(o.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      ) : (
        <AdminEmptyState message="No orders yet." />
      )}
    </div>
  );
}
