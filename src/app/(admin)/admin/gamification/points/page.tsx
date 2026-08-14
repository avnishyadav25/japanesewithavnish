import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

type PointsRow = {
  id: string;
  user_email: string;
  type: string;
  points: number;
  reason: string | null;
  created_at: string;
};

export default async function AdminGamificationPointsPage() {
  let rows: PointsRow[] = [];

  if (sql) {
    try {
      rows = (await sql`
        SELECT id, user_email, type, points, reason, created_at::text
        FROM points_transactions
        ORDER BY created_at DESC
        LIMIT 200
      `) as PointsRow[];
    } catch (e) {
      console.error("Admin gamification points:", e);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Points Ledger"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Gamification" }, { label: "Points" }]}
      />
      <p className="text-secondary text-sm -mt-2">
        Recent points transactions across all users. To edit point-earning rules, see{" "}
        <a href="/admin/gamification/xp-rules" className="text-primary hover:underline">XP Rules</a>.
      </p>
      {rows.length > 0 ? (
        <AdminCard>
          <AdminTable headers={["User", "Type", "Points", "Reason", "Date"]}>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[var(--divider)] hover:bg-[var(--base)] transition-colors">
                <td className="py-2 px-2 font-medium text-charcoal">{r.user_email}</td>
                <td className="py-2 px-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.type === "earned" ? "bg-green-50 text-green-700" : r.type === "redeemed" ? "bg-primary/10 text-primary" : "bg-secondary/15 text-secondary"}`}>
                    {r.type}
                  </span>
                </td>
                <td className="py-2 px-2 text-secondary">{r.points}</td>
                <td className="py-2 px-2 text-secondary text-xs">{r.reason || "—"}</td>
                <td className="py-2 px-2 text-secondary text-xs">{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      ) : (
        <AdminEmptyState message="No points transactions yet." />
      )}
    </div>
  );
}
export const dynamic = "force-dynamic";
