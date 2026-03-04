import { notFound } from "next/navigation";
import { LEARN_CONTENT_TYPES, LEARN_TYPE_LABELS, type LearnContentType } from "@/lib/learn-filters";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { LearningContentForm } from "../../LearningContentForm";

export default async function AdminLearnNewPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const normalized = type.toLowerCase();
  if (!LEARN_CONTENT_TYPES.includes(normalized as LearnContentType)) notFound();

  return (
    <div>
      <AdminPageHeader
        title={`New ${LEARN_TYPE_LABELS[normalized as LearnContentType]}`}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Learning", href: `/admin/learn/${normalized}` },
        ]}
      />
      <LearningContentForm contentType={normalized} />
    </div>
  );
}
