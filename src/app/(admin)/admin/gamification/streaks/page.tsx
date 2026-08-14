import Link from "next/link";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

type StreakRow = {
  email: string;
  display_name: string | null;
  current_streak: number;
  longest_streak: number;
  streak_freezes: number | null;
  last_activity_date: string | null;
};

export default async function AdminGamificationStreaksPage() {
  let rows: StreakRow[] = [];

  if (sql) {
    try {
      rows = (await sql`
        SELECT email, display_name,
               COALESCE(current_streak, 0)::int AS current_streak,
               COALESCE(longest_streak, 0)::int AS longest_streak,
               streak_freezes,
               last_activity_date::text
        FROM profiles
        WHERE current_streak > 0 OR longest_streak > 0
        ORDER BY current_streak DESC, longest_streak DESC
        LIMIT 100
      `) as StreakRow[];
    } catch (e) {
      console.error("Admin gamification streaks:", e);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Streaks"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Gamification" }, { label: "Streaks" }]}
      />
      {rows.length > 0 ? (
        <AdminCard>
          <AdminTable headers={["Email", "Name", "Current Streak", "Longest Streak", "Freezes", "Last Activity"]}>
            {rows.map((r) => (
              <tr key={r.email} className="border-b border-[var(--divider)] hover:bg-[var(--base)] transition-colors">
                <td className="py-2 px-2 font-medium text-charcoal">
                  <Link href={`/admin/students/${encodeURIComponent(r.email)}`} className="text-primary hover:underline">{r.email}</Link>
                </td>
                <td className="py-2 px-2 text-secondary">{r.display_name || "—"}</td>
                <td className="py-2 px-2 text-secondary">{r.current_streak}</td>
                <td className="py-2 px-2 text-secondary">{r.longest_streak}</td>
                <td className="py-2 px-2 text-secondary">{r.streak_freezes ?? 0}</td>
                <td className="py-2 px-2 text-secondary text-xs">{r.last_activity_date ? new Date(r.last_activity_date).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      ) : (
        <AdminEmptyState message="No active streaks yet." />
      )}
    </div>
  );
}
export const dynamic = "force-dynamic";
