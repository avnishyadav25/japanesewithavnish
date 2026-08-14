import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AccessRulesForm } from "./AccessRulesForm";

export default async function AdminAccessRulesSettingsPage() {
  const settings: Record<string, string> = {
    free_daily_limit: "2",
    timezone: "Asia/Kolkata",
    reset_time: "00:00",
    keep_progress_on_expiry: "true",
    locked_warning_text: "You have completed your free daily sequential lesson allocation. Upgrade to premium to continue learning immediately, or wait until midnight.",
    upgrade_button_label: "Upgrade to Premium ★",
  };

  if (sql) {
    try {
      const rows = (await sql`
        SELECT key, value FROM site_settings
        WHERE key IN (
          'free_daily_limit',
          'timezone',
          'reset_time',
          'keep_progress_on_expiry',
          'locked_warning_text',
          'upgrade_button_label'
        )
      `) as { key: string; value: any }[];

      (rows ?? []).forEach((r) => {
        if (r.value !== null && r.value !== undefined) {
          settings[r.key] = String(r.value);
        }
      });
    } catch (e) {
      console.error("Access rules settings query error:", e);
    }
  }

  return (
    <div className="space-y-6 page-enter max-w-2xl">
      <AdminPageHeader
        title="Access Rules Settings"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Settings" }, { label: "Access Rules" }]}
      />
      <AccessRulesForm initial={settings} />
    </div>
  );
}
export const dynamic = "force-dynamic";
