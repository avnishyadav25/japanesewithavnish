import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminPaymentSettingsForm } from "./AdminPaymentSettingsForm";

const PAYMENT_KEYS = ["payment_accept_inr", "payment_accept_usd", "payment_default_provider"];

export default async function AdminPaymentSettingsPage() {
  const settings: Record<string, string> = {};

  if (sql) {
    try {
      const rows = (await sql`
        SELECT key, value FROM site_settings WHERE key = ANY(${PAYMENT_KEYS})
      `) as { key: string; value: unknown }[];
      (rows ?? []).forEach((r) => {
        settings[r.key] = r.value == null ? "" : String(r.value);
      });
    } catch (e) {
      console.error("Admin payment settings:", e);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <AdminPageHeader
        title="Payment Settings"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Settings" }, { label: "Payments" }]}
      />
      <AdminPaymentSettingsForm initial={settings} />
    </div>
  );
}
export const dynamic = "force-dynamic";
