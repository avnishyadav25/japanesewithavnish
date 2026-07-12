import Link from "next/link";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

type LeaderboardRow = {
  email: string;
  display_name: string | null;
  points: number;
  xp: number;
  current_streak: number;
  show_on_scoreboard: boolean | null;
};

export default async function AdminGamificationLeaderboardPage() {
  let rows: LeaderboardRow[] = [];

  if (sql) {
    try {
      rows = (await sql`
        SELECT email, display_name,
               COALESCE(points, 0)::int AS points,
               COALESCE(xp, 0)::int AS xp,
               COALESCE(current_streak, 0)::int AS current_streak,
               show_on_scoreboard
        FROM profiles
        WHERE COALESCE(points, 0) > 0 OR COALESCE(xp, 0) > 0
        ORDER BY xp DESC, points DESC
        LIMIT 100
      `) as LeaderboardRow[];
    } catch (e) {
      console.error("Admin gamification leaderboard:", e);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Leaderboard"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Gamification" }, { label: "Leaderboard" }]}
      />
      {rows.length > 0 ? (
        <AdminCard>
          <AdminTable headers={["Rank", "Email", "Name", "XP", "Points", "Streak", "Public"]}>
            {rows.map((r, i) => (
              <tr key={r.email} className="border-b border-[var(--divider)] hover:bg-[var(--base)] transition-colors">
                <td className="py-2 px-2 text-secondary text-xs w-10">{i + 1}</td>
                <td className="py-2 px-2 font-medium text-charcoal">
                  <Link href={`/admin/students/${encodeURIComponent(r.email)}`} className="text-primary hover:underline">{r.email}</Link>
                </td>
                <td className="py-2 px-2 text-secondary">{r.display_name || "—"}</td>
                <td className="py-2 px-2 text-secondary">{r.xp}</td>
                <td className="py-2 px-2 text-secondary">{r.points}</td>
                <td className="py-2 px-2 text-secondary">{r.current_streak}</td>
                <td className="py-2 px-2">
                  {r.show_on_scoreboard ? (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700">Yes</span>
                  ) : (
                    <span className="text-xs text-secondary">No</span>
                  )}
                </td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      ) : (
        <AdminEmptyState message="No ranked users yet." />
      )}
    </div>
  );
}
export const dynamic = "force-dynamic";
