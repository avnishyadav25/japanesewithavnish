import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { XPRulesForm } from "./XPRulesForm";

export default async function AdminXPRulesPage() {
  const rules: Record<string, string> = {
    xp_lesson_completed: "10",
    xp_practice_completed: "5",
    xp_quiz_passed: "15",
    xp_daily_streak: "20",
    points_multiplier: "1",
  };

  if (sql) {
    try {
      const rows = (await sql`
        SELECT key, value FROM site_settings
        WHERE key IN (
          'xp_lesson_completed',
          'xp_practice_completed',
          'xp_quiz_passed',
          'xp_daily_streak',
          'points_multiplier'
        )
      `) as { key: string; value: any }[];

      (rows ?? []).forEach((r) => {
        if (r.value !== null && r.value !== undefined) {
          rules[r.key] = String(r.value);
        }
      });
    } catch (e) {
      console.error("XP rules settings query error:", e);
    }
  }

  return (
    <div className="space-y-6 page-enter max-w-xl">
      <AdminPageHeader
        title="XP & Points Reward Rules"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Gamification" }, { label: "XP Rules" }]}
      />
      <p className="text-secondary text-sm">
        Configure how much XP and points students earn when completing learning tasks and preserving daily streaks.
      </p>
      <XPRulesForm initial={rules} />
    </div>
  );
}
export const dynamic = "force-dynamic";
