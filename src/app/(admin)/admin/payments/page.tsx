import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

type OrderRow = {
  id: string;
  user_email: string;
  provider: string;
  provider_payment_id: string | null;
  amount: number; // in paise
  currency: string;
  status: string;
  coupon_code: string | null;
  discount_amount: number | null;
  paid_at: string | null;
  failed_reason: string | null;
  created_at: string;
  plan_name: string | null;
};

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams?: { q?: string; status?: string };
}) {
  const searchQuery = searchParams?.q || "";
  const statusFilter = searchParams?.status || "";

  let orders: OrderRow[] = [];

  if (sql) {
    try {
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIdx = 1;

      if (statusFilter) {
        conditions.push(`o.status = $${paramIdx}`);
        params.push(statusFilter);
        paramIdx++;
      }

      if (searchQuery) {
        conditions.push(`(o.user_email ILIKE $${paramIdx} OR p.provider_payment_id ILIKE $${paramIdx} OR p.provider_order_id ILIKE $${paramIdx} OR o.coupon_code ILIKE $${paramIdx})`);
        params.push(`%${searchQuery}%`);
        paramIdx++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const query = `
        SELECT
          o.id,
          o.user_email,
          o.provider,
          COALESCE(p.provider_payment_id, p.provider_order_id) AS provider_payment_id,
          o.total_amount_paise AS amount,
          CASE WHEN o.provider = 'stripe' THEN 'USD' ELSE 'INR' END AS currency,
          o.status,
          o.coupon_code,
          o.discount_paise AS discount_amount,
          p.captured_at::text AS paid_at,
          NULL::text AS failed_reason,
          o.created_at::text,
          sp.name AS plan_name
        FROM orders o
        LEFT JOIN payments p ON p.order_id = o.id
        LEFT JOIN subscription_plans sp ON sp.id = o.plan_id
        ${whereClause}
        ORDER BY o.created_at DESC
        LIMIT 100
      `;

      const resultArr = [query, ...params];
      Object.defineProperty(resultArr, "raw", { value: [query] });
      orders = await sql(resultArr as any) as OrderRow[];

    } catch (e) {
      console.error("Admin payments query error:", e);
    }
  }

  return (
    <div className="space-y-6 page-enter">
      <AdminPageHeader
        title="Razorpay & Stripe Payments"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Payments" }]}
      />

      <div className="bg-white border border-[var(--divider)] rounded-3xl p-5 shadow-sm space-y-4">
        <form method="GET" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] font-bold uppercase text-secondary mb-1">Search Payment</label>
            <input
              type="text"
              name="q"
              defaultValue={searchQuery}
              placeholder="Email, Coupon or Ref ID..."
              className="w-full h-10 px-3 border border-[var(--divider)] rounded-xl text-xs text-charcoal focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-secondary mb-1">Payment Status</label>
            <select
              name="status"
              defaultValue={statusFilter}
              className="w-full h-10 px-3 border border-[var(--divider)] rounded-xl text-xs text-charcoal bg-white"
            >
              <option value="">All Transactions</option>
              <option value="paid">Successful</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="w-full btn-primary h-10 rounded-xl text-xs font-bold font-heading">
              Filter Payments
            </button>
          </div>
        </form>
      </div>

      {orders.length > 0 ? (
        <AdminCard>
          <AdminTable headers={["User Email", "Plan Pass", "Payment ID", "Discount / Coupon", "Paid Amount", "Status", "Date"]}>
            {orders.map((o) => {
              const isPaid = o.status === "paid";
              const endsSymbol = o.currency === "INR" ? "₹" : "$";
              const paidVal = endsSymbol + (o.amount / 100).toFixed(2);
              const discVal = o.discount_amount ? (endsSymbol + (o.discount_amount / 100).toFixed(2)) : "None";

              return (
                <tr key={o.id} className="border-b border-[var(--divider)] hover:bg-[var(--base)] transition-colors">
                  <td className="py-3 px-2 font-bold text-charcoal text-xs">{o.user_email}</td>
                  <td className="py-3 px-2 text-secondary text-xs">{o.plan_name || "Bundle / Legacy"}</td>
                  <td className="py-3 px-2 text-mono text-secondary text-[10px] truncate max-w-[120px]">{o.provider_payment_id || "—"}</td>
                  <td className="py-3 px-2">
                    {o.coupon_code ? (
                      <div>
                        <span className="text-[10px] font-bold font-mono bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded">
                          {o.coupon_code}
                        </span>
                        <div className="text-[9px] text-secondary mt-0.5">Discount: {discVal}</div>
                      </div>
                    ) : (
                      <span className="text-secondary text-xs">—</span>
                    )}
                  </td>
                  <td className="py-3 px-2 font-bold text-charcoal text-xs">{paidVal}</td>
                  <td className="py-3 px-2">
                    <StatusBadge
                      status={o.status}
                      variant={isPaid ? "paid" : o.status === "failed" ? "failed" : "pending"}
                    />
                    {o.failed_reason && (
                      <div className="text-[9px] text-primary mt-1 max-w-[150px] truncate" title={o.failed_reason}>
                        Reason: {o.failed_reason}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-2 text-[10px] text-secondary">
                    {new Date(o.created_at).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </AdminTable>
        </AdminCard>
      ) : (
        <AdminEmptyState message="No matching payments found." />
      )}
    </div>
  );
}
export const dynamic = "force-dynamic";
