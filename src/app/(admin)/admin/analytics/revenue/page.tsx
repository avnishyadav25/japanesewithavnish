import { sql } from "@/lib/db";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";

type RecentPayment = { order_id: string; user_email: string; amount: number; currency: string; status: string; provider_payment_id: string | null; created_at: string };
type PlanRow = { plan_name: string | null; payments: number; revenue: number };

async function safeQuery<T>(query: PromiseLike<unknown>): Promise<T | null> {
  try {
    return (await query) as T;
  } catch (error) {
    console.error("Admin revenue analytics query:", error);
    return null;
  }
}

function money(amount: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format((Number(amount) || 0) / 100);
}

export default async function AdminRevenueAnalyticsPage() {
  let metrics = { revenue: 0, paid: 0, failed: 0, pending: 0, coupons: 0 };
  let recent: RecentPayment[] = [];
  let plans: PlanRow[] = [];

  if (sql) {
    const metricRows = await safeQuery<(typeof metrics)[]>(sql`
      SELECT
        COALESCE(SUM(total_amount_paise) FILTER (WHERE status = 'paid'), 0)::int AS revenue,
        COUNT(*) FILTER (WHERE status = 'paid')::int AS paid,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
        COUNT(*) FILTER (WHERE status IN ('created','pending'))::int AS pending,
        COUNT(*) FILTER (WHERE coupon_code IS NOT NULL AND coupon_code <> '')::int AS coupons
      FROM orders
    `);
    const recentRows = await safeQuery<RecentPayment[]>(sql`
      SELECT o.id AS order_id, o.user_email, o.total_amount_paise AS amount, COALESCE(sp.currency, 'INR') AS currency,
        o.status, p.provider_payment_id, o.created_at
      FROM orders o
      LEFT JOIN payments p ON p.order_id = o.id
      LEFT JOIN subscription_payments sp ON sp.provider_order_id = p.provider_order_id OR sp.provider_payment_id = p.provider_payment_id
      ORDER BY o.created_at DESC
      LIMIT 30
    `);
    const planRows = await safeQuery<PlanRow[]>(sql`
      SELECT COALESCE(pl.name, o.plan_id::text, 'Product/order') AS plan_name,
        COUNT(*)::int AS payments,
        COALESCE(SUM(o.total_amount_paise), 0)::int AS revenue
      FROM orders o
      LEFT JOIN subscription_plans pl ON pl.id = o.plan_id
      WHERE o.status = 'paid'
      GROUP BY plan_name
      ORDER BY revenue DESC
    `);
    metrics = metricRows?.[0] ?? metrics;
    recent = recentRows ?? [];
    plans = planRows ?? [];
  }

  return (
    <div>
      <AdminPageHeader
        title="Revenue Analytics"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Analytics", href: "/admin/analytics" }, { label: "Revenue" }]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
        <AdminCard><p className="text-xs uppercase tracking-wider text-secondary">Paid revenue</p><p className="font-heading text-3xl font-bold">{money(metrics.revenue)}</p></AdminCard>
        <AdminCard><p className="text-xs uppercase tracking-wider text-secondary">Paid orders</p><p className="font-heading text-3xl font-bold">{Number(metrics.paid)}</p></AdminCard>
        <AdminCard><p className="text-xs uppercase tracking-wider text-secondary">Failed orders</p><p className="font-heading text-3xl font-bold">{Number(metrics.failed)}</p></AdminCard>
        <AdminCard><p className="text-xs uppercase tracking-wider text-secondary">Pending orders</p><p className="font-heading text-3xl font-bold">{Number(metrics.pending)}</p></AdminCard>
        <AdminCard><p className="text-xs uppercase tracking-wider text-secondary">Coupon orders</p><p className="font-heading text-3xl font-bold">{Number(metrics.coupons)}</p></AdminCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <AdminCard>
          <h2 className="font-heading text-lg font-semibold mb-4">Plan Split</h2>
          {plans.length ? (
            <AdminTable headers={["Plan", "Paid orders", "Revenue"]}>
              {plans.map((row) => (
                <tr key={row.plan_name || "unknown"} className="border-b border-[var(--divider)]">
                  <td className="py-2 px-2 font-medium">{row.plan_name || "Unknown"}</td>
                  <td className="py-2 px-2">{Number(row.payments)}</td>
                  <td className="py-2 px-2">{money(row.revenue)}</td>
                </tr>
              ))}
            </AdminTable>
          ) : <AdminEmptyState message="No paid plan data yet." />}
        </AdminCard>

        <AdminCard>
          <h2 className="font-heading text-lg font-semibold mb-4">Recent Orders</h2>
          {recent.length ? (
            <AdminTable headers={["Email", "Amount", "Status", "Date"]}>
              {recent.map((row) => (
                <tr key={`${row.order_id}-${row.provider_payment_id || ""}`} className="border-b border-[var(--divider)]">
                  <td className="py-2 px-2 font-medium">{row.user_email}</td>
                  <td className="py-2 px-2">{money(row.amount, row.currency || "INR")}</td>
                  <td className="py-2 px-2">{row.status}</td>
                  <td className="py-2 px-2 text-secondary">{new Date(row.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </AdminTable>
          ) : <AdminEmptyState message="No orders yet." />}
        </AdminCard>
      </div>
    </div>
  );
}
