import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { LearningContentForm } from "../../LearningContentForm";

const TYPES = ["grammar", "vocabulary", "kanji", "reading", "writing"] as const;
const TYPE_LABELS: Record<string, string> = {
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  kanji: "Kanji",
  reading: "Reading",
  writing: "Writing",
};

export default async function AdminLearnNewPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const normalized = type.toLowerCase();
  if (!TYPES.includes(normalized as (typeof TYPES)[number])) notFound();

  return (
    <div>
      <AdminPageHeader
        title={`New ${TYPE_LABELS[normalized]}`}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Learning", href: `/admin/learn/${normalized}` },
        ]}
      />
      <LearningContentForm contentType={normalized} />
    </div>
  );
}
