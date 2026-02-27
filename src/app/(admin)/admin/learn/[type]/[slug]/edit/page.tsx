import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { LearningContentForm } from "../../../LearningContentForm";

const TYPES = ["grammar", "vocabulary", "kanji", "reading", "writing"] as const;

export default async function AdminLearnEditPage({
  params,
}: {
  params: Promise<{ type: string; slug: string }>;
}) {
  const { type, slug } = await params;
  const normalized = type.toLowerCase();
  if (!TYPES.includes(normalized as (typeof TYPES)[number])) notFound();

  const supabase = createAdminClient();
  const { data: item, error } = await supabase
    .from("learning_content")
    .select("*")
    .eq("content_type", normalized)
    .eq("slug", slug)
    .single();

  if (error || !item) notFound();

  return (
    <div>
      <AdminPageHeader
        title={`Edit ${item.title}`}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Learning", href: `/admin/learn/${normalized}` },
        ]}
      />
      <LearningContentForm contentType={normalized} item={item} />
    </div>
  );
}
