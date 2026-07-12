import Link from "next/link";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

type ActivityRow = {
  email: string;
  display_name: string | null;
  last_login_at: string | null;
  last_activity_date: string | null;
  current_streak: number;
  points_earned_30d: number;
  events_30d: number;
};

export default async function AdminUserActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  let rows: ActivityRow[] = [];

  if (sql) {
    try {
      rows = (q
        ? await sql`
            SELECT
              p.email, p.display_name, p.last_login_at::text, p.last_activity_date::text,
              COALESCE(p.current_streak, 0)::int AS current_streak,
              (SELECT COALESCE(SUM(pt.points), 0)::int FROM points_transactions pt WHERE pt.user_email = p.email AND pt.created_at >= NOW() - INTERVAL '30 days') AS points_earned_30d,
              (SELECT COUNT(*)::int FROM reward_events re WHERE re.user_email = p.email AND re.created_at >= NOW() - INTERVAL '30 days') AS events_30d
            FROM profiles p
            WHERE p.email ILIKE ${`%${q}%`}
            ORDER BY p.last_activity_date DESC NULLS LAST
            LIMIT 100
          `
        : await sql`
            SELECT
              p.email, p.display_name, p.last_login_at::text, p.last_activity_date::text,
              COALESCE(p.current_streak, 0)::int AS current_streak,
              (SELECT COALESCE(SUM(pt.points), 0)::int FROM points_transactions pt WHERE pt.user_email = p.email AND pt.created_at >= NOW() - INTERVAL '30 days') AS points_earned_30d,
              (SELECT COUNT(*)::int FROM reward_events re WHERE re.user_email = p.email AND re.created_at >= NOW() - INTERVAL '30 days') AS events_30d
            FROM profiles p
            ORDER BY p.last_activity_date DESC NULLS LAST
            LIMIT 100
          `) as unknown as ActivityRow[];
    } catch (e) {
      console.error("Admin user activity:", e);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="User Activity"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Users" }, { label: "Activity" }]}
      />
      <AdminCard>
        <form className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Filter by email..."
            className="flex-1 h-10 px-3 border border-[var(--divider)] rounded-xl text-xs text-charcoal focus:outline-none"
          />
          <button type="submit" className="btn-primary text-xs px-4 h-10">Filter</button>
        </form>
      </AdminCard>

      {rows.length > 0 ? (
        <AdminCard>
          <AdminTable headers={["Email", "Name", "Streak", "Points (30d)", "Events (30d)", "Last login", "Last activity"]}>
            {rows.map((r) => (
              <tr key={r.email} className="border-b border-[var(--divider)] hover:bg-[var(--base)] transition-colors">
                <td className="py-2 px-2 font-medium text-charcoal">
                  <Link href={`/admin/students/${encodeURIComponent(r.email)}`} className="text-primary hover:underline">
                    {r.email}
                  </Link>
                </td>
                <td className="py-2 px-2 text-secondary">{r.display_name || "—"}</td>
                <td className="py-2 px-2 text-secondary">{r.current_streak}</td>
                <td className="py-2 px-2 text-secondary">{r.points_earned_30d}</td>
                <td className="py-2 px-2 text-secondary">{r.events_30d}</td>
                <td className="py-2 px-2 text-secondary text-xs">{r.last_login_at ? new Date(r.last_login_at).toLocaleString() : "—"}</td>
                <td className="py-2 px-2 text-secondary text-xs">{r.last_activity_date ? new Date(r.last_activity_date).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      ) : (
        <AdminEmptyState message="No matching user activity found." />
      )}
    </div>
  );
}
export const dynamic = "force-dynamic";
