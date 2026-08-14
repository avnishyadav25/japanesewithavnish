import { sql } from "@/lib/db";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";

type Metric = { label: string; value: string; detail?: string };
type RecentUser = {
  email: string;
  display_name: string | null;
  created_at: string | null;
  last_activity_date: string | null;
  email_verified_at: string | null;
  premium_until: string | null;
  is_lifetime: boolean | null;
};

async function safeQuery<T>(query: PromiseLike<unknown>): Promise<T | null> {
  try {
    return (await query) as T;
  } catch (error) {
    console.error("Admin users analytics query:", error);
    return null;
  }
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "-";
}

export default async function AdminUsersAnalyticsPage() {
  let metrics: Metric[] = [
    { label: "Total users", value: "0" },
    { label: "New users 30d", value: "0" },
    { label: "Active learners 7d", value: "0" },
    { label: "Premium users", value: "0" },
    { label: "Verified email", value: "0" },
    { label: "Unverified email", value: "0" },
  ];
  let recentUsers: RecentUser[] = [];

  if (sql) {
    const profileRows = await safeQuery<{ total: number; new_30d: number; active_7d: number; premium: number }[]>(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::int AS new_30d,
        COUNT(*) FILTER (WHERE last_activity_date >= CURRENT_DATE - INTERVAL '7 days')::int AS active_7d,
        COUNT(*) FILTER (WHERE is_lifetime = TRUE OR premium_until > NOW())::int AS premium
      FROM profiles
    `);
    const verifyRows = await safeQuery<{ verified: number; unverified: number }[]>(sql`
      SELECT
        COUNT(*) FILTER (WHERE email_verified_at IS NOT NULL)::int AS verified,
        COUNT(*) FILTER (WHERE email_verified_at IS NULL)::int AS unverified
      FROM user_auth
    `);
    const recentRows = await safeQuery<RecentUser[]>(sql`
      SELECT
        p.email,
        p.display_name,
        p.created_at,
        p.last_activity_date,
        p.premium_until,
        p.is_lifetime,
        ua.email_verified_at
      FROM profiles p
      LEFT JOIN user_auth ua ON LOWER(ua.email) = LOWER(p.email)
      ORDER BY p.created_at DESC NULLS LAST
      LIMIT 20
    `);

    const p = profileRows?.[0];
    const v = verifyRows?.[0];
    metrics = [
      { label: "Total users", value: String(Number(p?.total ?? 0)) },
      { label: "New users 30d", value: String(Number(p?.new_30d ?? 0)) },
      { label: "Active learners 7d", value: String(Number(p?.active_7d ?? 0)), detail: "Based on last activity date" },
      { label: "Premium users", value: String(Number(p?.premium ?? 0)), detail: "Lifetime or active premium_until" },
      { label: "Verified email", value: String(Number(v?.verified ?? 0)) },
      { label: "Unverified email", value: String(Number(v?.unverified ?? 0)) },
    ];
    recentUsers = recentRows ?? [];
  }

  return (
    <div>
      <AdminPageHeader
        title="User Analytics"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Analytics", href: "/admin/analytics" }, { label: "Users" }]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        {metrics.map((metric) => (
          <AdminCard key={metric.label}>
            <p className="text-xs uppercase tracking-wider text-secondary">{metric.label}</p>
            <p className="font-heading text-3xl font-bold text-charcoal mt-1">{metric.value}</p>
            {metric.detail ? <p className="text-xs text-secondary mt-2">{metric.detail}</p> : null}
          </AdminCard>
        ))}
      </div>

      <AdminCard>
        <h2 className="font-heading text-lg font-semibold text-charcoal mb-4">Newest Users</h2>
        {recentUsers.length ? (
          <AdminTable headers={["Email", "Name", "Joined", "Last active", "Verified", "Premium"]}>
            {recentUsers.map((user) => (
              <tr key={user.email} className="border-b border-[var(--divider)]">
                <td className="py-2 px-2 font-medium text-charcoal">{user.email}</td>
                <td className="py-2 px-2 text-secondary">{user.display_name || "-"}</td>
                <td className="py-2 px-2 text-secondary">{formatDate(user.created_at)}</td>
                <td className="py-2 px-2 text-secondary">{formatDate(user.last_activity_date)}</td>
                <td className="py-2 px-2">{user.email_verified_at ? "Verified" : "Unverified"}</td>
                <td className="py-2 px-2">{user.is_lifetime || (user.premium_until && new Date(user.premium_until) > new Date()) ? "Premium" : "Free"}</td>
              </tr>
            ))}
          </AdminTable>
        ) : (
          <AdminEmptyState message="No user analytics available yet." />
        )}
      </AdminCard>
    </div>
  );
}
