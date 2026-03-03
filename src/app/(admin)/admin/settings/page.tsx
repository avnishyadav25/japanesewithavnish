import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { CompanySettingsForm } from "./CompanySettingsForm";

const HOMEPAGE_KEYS = [
  "announcement_bar",
  "bundle_comparison",
  "study_roadmap",
  "homepage_feature_strip",
  "testimonials_about",
  "homepage_faq",
];

export default async function AdminSettingsPage() {
  const settings: Record<string, string | unknown> = {};
  const homepageSettings: Record<string, unknown> = {};
  try {
    if (sql) {
      const rows = (await sql`SELECT key, value FROM site_settings`) as { key: string; value: unknown }[];
      (rows ?? []).forEach((r) => {
        const v = r.value;
        if (HOMEPAGE_KEYS.includes(r.key)) {
          homepageSettings[r.key] = v ?? null;
          settings[r.key] = v ?? null;
        } else {
          settings[r.key] = v == null ? "" : String(v);
        }
      });
    }
  } catch {
    // Table may not exist yet
  }

  return (
    <div>
      <AdminPageHeader
        title="Company Settings"
        breadcrumb={[{ label: "Admin", href: "/admin" }]}
      />
      <CompanySettingsForm initial={settings} homepageInitial={homepageSettings} />
    </div>
  );
}
