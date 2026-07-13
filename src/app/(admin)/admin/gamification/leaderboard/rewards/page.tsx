import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { RewardModeForm } from "./RewardModeForm";

type CycleRow = {
  period_start: string;
  period_end: string;
  rank: number;
  user_email: string;
  xp_total: number;
  reward_mode: string;
  reward_status: string;
  granted_at: string | null;
};

export default async function AdminLeaderboardRewardsPage() {
  let currentMode = "manual_review";
  let cycles: CycleRow[] = [];

  if (sql) {
    const [settingsRows, cycleRows] = await Promise.all([
      sql`SELECT value FROM site_settings WHERE key = 'leaderboard_reward_mode' LIMIT 1`,
      sql`
        SELECT period_start::text, period_end::text, rank, user_email, xp_total, reward_mode, reward_status, granted_at::text
        FROM leaderboard_reward_cycles
        ORDER BY period_start DESC, rank ASC
        LIMIT 30
      `,
    ]);
    const raw = (settingsRows as { value: unknown }[])?.[0]?.value;
    if (typeof raw === "string") currentMode = raw;
    cycles = (cycleRows ?? []) as CycleRow[];
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Leaderboard Rewards"
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Gamification" },
          { label: "Leaderboard", href: "/admin/gamification/leaderboard" },
          { label: "Rewards" },
        ]}
      />
      <p className="text-secondary text-sm max-w-2xl">
        On the 1st of each month, the top 3 XP earners from the previous month are recorded here and rewarded
        with a free month, according to the mode below. The same logic also runs automatically via the monthly cron.
      </p>

      <AdminCard>
        <RewardModeForm initialMode={currentMode} />
      </AdminCard>

      {cycles.length > 0 ? (
        <AdminCard>
          <AdminTable headers={["Period", "Rank", "User", "XP", "Mode", "Status"]}>
            {cycles.map((c) => (
              <tr key={`${c.period_start}-${c.rank}`} className="border-b border-[var(--divider)]">
                <td className="py-2 px-2 text-secondary text-xs">{c.period_start}</td>
                <td className="py-2 px-2 text-charcoal font-semibold">#{c.rank}</td>
                <td className="py-2 px-2 text-charcoal">{c.user_email}</td>
                <td className="py-2 px-2 text-secondary">{c.xp_total}</td>
                <td className="py-2 px-2 text-secondary text-xs">{c.reward_mode}</td>
                <td className="py-2 px-2">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      c.reward_status === "granted" ? "bg-green-50 text-green-700" : "bg-secondary/15 text-secondary"
                    }`}
                  >
                    {c.reward_status}
                  </span>
                </td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      ) : (
        <AdminEmptyState message="No reward cycles recorded yet — the first one is generated on the 1st of next month." />
      )}
    </div>
  );
}
