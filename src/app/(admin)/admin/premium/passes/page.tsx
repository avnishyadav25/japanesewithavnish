import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

type SubscriptionPass = {
  user_email: string;
  status: string;
  current_period_end: string | null;
  trial_ends_at: string | null;
  provider: string | null;
  plan_name: string;
  created_at: string;
};

export default async function AdminPremiumPassesPage({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  const statusFilter = searchParams?.status || "";
  let passes: SubscriptionPass[] = [];

  if (sql) {
    try {
      let query = `
        SELECT
          us.user_email,
          us.status,
          us.current_period_end::text,
          us.trial_ends_at::text,
          us.provider,
          sp.name AS plan_name,
          us.created_at::text
        FROM user_subscriptions us
        JOIN subscription_plans sp ON sp.id = us.plan_id
      `;

      const conditions: string[] = [];
      const params: any[] = [];

      if (statusFilter === "expired") {
        conditions.push(`us.status = 'expired' OR us.current_period_end <= NOW()`);
      } else if (statusFilter === "trial") {
        conditions.push(`us.status = 'trialing' AND us.trial_ends_at > NOW()`);
      } else if (statusFilter === "active") {
        conditions.push(`us.status = 'active' AND (us.current_period_end > NOW() OR us.current_period_end IS NULL)`);
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(" AND ")}`;
      }

      query += ` ORDER BY us.created_at DESC LIMIT 100`;

      const resultArr = [query, ...params];
      Object.defineProperty(resultArr, "raw", { value: [query] });
      passes = await sql(resultArr as any) as SubscriptionPass[];

    } catch (e) {
      console.error("Premium passes query error:", e);
    }
  }

  return (
    <div className="space-y-6 page-enter">
      <AdminPageHeader
        title="Active Subscription Passes"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Premium Access" }, { label: "Passes" }]}
      />

      <div className="flex gap-2">
        {([
          { label: "All Passes", val: "" },
          { label: "Active Passes", val: "active" },
          { label: "Trialing", val: "trial" },
          { label: "Expired", val: "expired" },
        ] as const).map((opt) => (
          <a
            key={opt.val}
            href={`/admin/premium/passes?status=${opt.val}`}
            className={`text-xs px-3 py-1.5 rounded-full font-bold border ${statusFilter === opt.val ? "bg-primary border-primary text-white" : "border-[var(--divider)] text-secondary hover:bg-[var(--base)]"}`}
          >
            {opt.label}
          </a>
        ))}
      </div>

      {passes.length > 0 ? (
        <AdminCard>
          <AdminTable headers={["User Email", "Plan Tier", "Provider", "Pass Period Ends", "Status"]}>
            {passes.map((p, idx) => {
              const ends = p.current_period_end ? new Date(p.current_period_end) : null;
              const isExpired = ends && ends < new Date();
              const badgeVariant = p.status === "active" && !isExpired ? "paid" : p.status === "trialing" ? "pending" : "failed";

              return (
                <tr key={idx} className="border-b border-[var(--divider)] hover:bg-[var(--base)] transition-colors">
                  <td className="py-3 px-2 font-bold text-charcoal text-xs">{p.user_email}</td>
                  <td className="py-3 px-2 text-secondary text-xs">{p.plan_name}</td>
                  <td className="py-3 px-2 text-secondary text-xs uppercase font-medium">{p.provider || "manual"}</td>
                  <td className="py-3 px-2 text-xs font-medium text-charcoal">
                    {ends ? ends.toLocaleDateString() : "Lifetime"}
                  </td>
                  <td className="py-3 px-2">
                    <StatusBadge
                      status={isExpired ? "expired" : p.status}
                      variant={isExpired ? "failed" : badgeVariant}
                    />
                  </td>
                </tr>
              );
            })}
          </AdminTable>
        </AdminCard>
      ) : (
        <AdminEmptyState message="No subscriber passes found for this filter." />
      )}
    </div>
  );
}
export const dynamic = "force-dynamic";
