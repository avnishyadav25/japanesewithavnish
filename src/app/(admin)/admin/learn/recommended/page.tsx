import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { LearnRecommendedForm } from "./LearnRecommendedForm";

const LEVELS = ["all", "n5", "n4", "n3", "n2", "n1"] as const;
const LEVEL_LABELS: Record<string, string> = {
  all: "All (default)",
  n5: "N5",
  n4: "N4",
  n3: "N3",
  n2: "N2",
  n1: "N1",
};

export default async function AdminLearnRecommendedPage() {
  const supabase = createAdminClient();
  const { data: setting } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "learn_recommended")
    .maybeSingle();

  const value = (setting?.value as Record<string, string[]>) || {};
  const initial: Record<string, string[]> = {};
  for (const level of LEVELS) {
    initial[level] = Array.isArray(value[level]) ? value[level] : [];
  }

  return (
    <div>
      <AdminPageHeader
        title="Recommended lessons (Learn)"
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Learning" },
          { label: "Recommended" },
        ]}
      />
      <p className="text-secondary text-sm mb-6 max-w-[600px]">
        Curate up to 6 lesson slugs per JLPT level. These appear in the &quot;Recommended lessons&quot; section on the Learn page. Use learning content slugs (e.g. from Grammar, Vocabulary, etc.).
      </p>
      <LearnRecommendedForm initial={initial} levelLabels={LEVEL_LABELS} />
    </div>
  );
}
