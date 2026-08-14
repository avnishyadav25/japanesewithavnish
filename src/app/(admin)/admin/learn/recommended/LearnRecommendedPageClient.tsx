"use client";

import { useRef } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { LearnRecommendedForm, type LearnRecommendedFormRef } from "./LearnRecommendedForm";

const LEVEL_LABELS: Record<string, string> = {
  all: "All (default)",
  n5: "N5",
  n4: "N4",
  n3: "N3",
  n2: "N2",
  n1: "N1",
};

interface LearnRecommendedPageClientProps {
  initial: Record<string, string[]>;
}

export function LearnRecommendedPageClient({ initial }: LearnRecommendedPageClientProps) {
  const formRef = useRef<LearnRecommendedFormRef>(null);

  return (
    <div>
      <AdminPageHeader
        title="Recommended lessons (Learn)"
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Learning" },
          { label: "Recommended" },
        ]}
        actions={[
          {
            label: "Refresh from DB",
            onClick: () => formRef.current?.pullFromDb(),
          },
        ]}
      />
      <p className="text-secondary text-sm mb-6 max-w-[600px]">
        Curate up to 6 lesson slugs per JLPT level. These appear in the &quot;Recommended lessons&quot; section on the Learn page. Use learning content slugs (e.g. from Grammar, Vocabulary, etc.). Empty levels are prepopulated from published content; use &quot;Refresh from DB&quot; (top right) or &quot;Pull from database&quot; below to refresh from current data.
      </p>
      <LearnRecommendedForm ref={formRef} initial={initial} levelLabels={LEVEL_LABELS} />
    </div>
  );
}
