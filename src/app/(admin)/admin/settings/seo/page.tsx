import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminSeoSettingsForm } from "./AdminSeoSettingsForm";

const SEO_KEYS = ["seo_default_title", "seo_default_description", "seo_default_og_image"];

export default async function AdminSeoSettingsPage() {
  const settings: Record<string, string> = {};

  if (sql) {
    try {
      const rows = (await sql`
        SELECT key, value FROM site_settings WHERE key = ANY(${SEO_KEYS})
      `) as { key: string; value: unknown }[];
      (rows ?? []).forEach((r) => {
        settings[r.key] = r.value == null ? "" : String(r.value);
      });
    } catch (e) {
      console.error("Admin SEO settings:", e);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <AdminPageHeader
        title="SEO Settings"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Settings" }, { label: "SEO" }]}
      />
      <AdminSeoSettingsForm initial={settings} />
    </div>
  );
}
export const dynamic = "force-dynamic";
