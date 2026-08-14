import Link from "next/link";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { OrdersTableClient } from "./OrdersTableClient";

type OrderRow = {
  id: string;
  user_email: string;
  status: string;
  total_amount_paise: number;
  created_at: string;
  last_confirmation_email_at?: string | null;
};

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  let orders: OrderRow[] | null = null;

  if (sql) {
    const statusFilter = status && status !== "all" ? status : null;
    const rows = statusFilter
      ? await sql`SELECT id, user_email, status, total_amount_paise, created_at FROM orders WHERE status = ${statusFilter} ORDER BY created_at DESC LIMIT 50`
      : await sql`SELECT id, user_email, status, total_amount_paise, created_at FROM orders ORDER BY created_at DESC LIMIT 50`;
    orders = rows as OrderRow[];
  } else {
    orders = [];
  }

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
          <OrdersTableClient orders={orders} />
        </AdminCard>
      ) : (
        <AdminEmptyState message="No orders yet." />
      )}
    </div>
  );
}
