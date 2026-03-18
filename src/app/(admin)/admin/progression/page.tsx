import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ProgressionRulesForm } from "./ProgressionRulesForm";

const DEFAULT_RULES = {
  max_reviews_due_before_advance: 20,
  min_accuracy_to_unlock_module: 0,
  daily_min_kanji: 0,
  daily_min_reading: 0,
};

export default async function AdminProgressionPage() {
  let initial = DEFAULT_RULES;
  try {
    if (sql) {
      const rows = (await sql`
        SELECT value FROM site_settings WHERE key = 'progression_rules' LIMIT 1
      `) as { value: unknown }[];
      const v = rows[0]?.value;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        initial = { ...DEFAULT_RULES, ...(v as Record<string, number>) };
      }
    }
  } catch {
    // ignore
  }

  return (
    <div>
      <AdminPageHeader
        title="Progression rules"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Settings", href: "/admin/settings" }]}
      />
      <ProgressionRulesForm initial={initial} />
    </div>
  );
}
