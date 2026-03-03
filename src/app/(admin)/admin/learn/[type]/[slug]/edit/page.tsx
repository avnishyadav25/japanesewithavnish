import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
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

  if (!sql) notFound();
  const rows = await sql`
    SELECT * FROM learning_content
    WHERE content_type = ${normalized} AND slug = ${slug} LIMIT 1
  `;
  const item = rows[0] as Record<string, unknown> | undefined;
  if (!item) notFound();

  return (
    <div>
      <AdminPageHeader
        title={`Edit ${item.title as string}`}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Learning", href: `/admin/learn/${normalized}` },
        ]}
      />
      <LearningContentForm contentType={normalized} item={item as unknown as Parameters<typeof LearningContentForm>[0]["item"]} />
    </div>
  );
}
