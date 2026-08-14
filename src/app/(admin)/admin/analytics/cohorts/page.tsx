import { sql } from "@/lib/db";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminTable } from "@/components/admin/AdminTable";

type Cohort = {
  cohort_week: string;
  users: number;
  active_1d: number;
  active_7d: number;
  active_30d: number;
  premium_users: number;
  completed_lessons: number;
};

async function safeQuery<T>(query: PromiseLike<unknown>): Promise<T | null> {
  try {
    return (await query) as T;
  } catch (error) {
    console.error("Admin cohort analytics query:", error);
    return null;
  }
}

function pct(value: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

export default async function AdminCohortsAnalyticsPage() {
  let cohorts: Cohort[] = [];

  if (sql) {
    const rows = await safeQuery<Cohort[]>(sql`
      SELECT
        DATE_TRUNC('week', p.created_at)::date AS cohort_week,
        COUNT(DISTINCT p.email)::int AS users,
        COUNT(DISTINCT p.email) FILTER (WHERE p.last_activity_date >= p.created_at::date + INTERVAL '1 day')::int AS active_1d,
        COUNT(DISTINCT p.email) FILTER (WHERE p.last_activity_date >= p.created_at::date + INTERVAL '7 days')::int AS active_7d,
        COUNT(DISTINCT p.email) FILTER (WHERE p.last_activity_date >= p.created_at::date + INTERVAL '30 days')::int AS active_30d,
        COUNT(DISTINCT p.email) FILTER (WHERE p.is_lifetime = TRUE OR p.premium_until IS NOT NULL)::int AS premium_users,
        COUNT(ulp.id)::int AS completed_lessons
      FROM profiles p
      LEFT JOIN user_lesson_progress ulp ON LOWER(ulp.user_email) = LOWER(p.email) AND ulp.status = 'completed'
      GROUP BY cohort_week
      ORDER BY cohort_week DESC
      LIMIT 26
    `);
    cohorts = rows ?? [];
  }

  return (
    <div>
      <AdminPageHeader
        title="Cohort Analytics"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Analytics", href: "/admin/analytics" }, { label: "Cohorts" }]}
      />
      <AdminCard>
        <h2 className="font-heading text-lg font-semibold mb-4">Signup Cohorts</h2>
        {cohorts.length ? (
          <AdminTable headers={["Week", "Users", "D1 active", "D7 active", "D30 active", "Premium", "Avg lessons"]}>
            {cohorts.map((row) => (
              <tr key={row.cohort_week} className="border-b border-[var(--divider)]">
                <td className="py-2 px-2 font-medium">{new Date(row.cohort_week).toLocaleDateString()}</td>
                <td className="py-2 px-2">{Number(row.users)}</td>
                <td className="py-2 px-2">{pct(Number(row.active_1d), Number(row.users))}</td>
                <td className="py-2 px-2">{pct(Number(row.active_7d), Number(row.users))}</td>
                <td className="py-2 px-2">{pct(Number(row.active_30d), Number(row.users))}</td>
                <td className="py-2 px-2">{pct(Number(row.premium_users), Number(row.users))}</td>
                <td className="py-2 px-2">{Number(row.users) ? Math.round((Number(row.completed_lessons) / Number(row.users)) * 10) / 10 : 0}</td>
              </tr>
            ))}
          </AdminTable>
        ) : (
          <AdminEmptyState message="No cohort data yet." />
        )}
      </AdminCard>
    </div>
  );
}
