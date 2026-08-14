import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { GuideSectionForm } from "@/components/admin/GuideSectionForm";

export default async function AdminGuideEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!sql) notFound();

  const rows = await sql`
    SELECT id, title, slug, short_description, body, icon, feature_image_url, link_href, link_label, sort_order, published
    FROM platform_guide_sections
    WHERE id = ${id}
    LIMIT 1
  `;
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) notFound();

  const section = {
    id: String(row.id),
    title: String(row.title ?? ""),
    slug: String(row.slug ?? ""),
    short_description: String(row.short_description ?? ""),
    body: row.body != null ? String(row.body) : "",
    icon: row.icon != null ? String(row.icon) : "",
    feature_image_url: row.feature_image_url != null ? String(row.feature_image_url) : "",
    link_href: row.link_href != null ? String(row.link_href) : "",
    link_label: row.link_label != null ? String(row.link_label) : "",
    sort_order: Number(row.sort_order) || 0,
    published: Boolean(row.published),
  };

  return (
    <div>
      <AdminPageHeader
        title="Edit guide section"
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Site Guide", href: "/admin/guide" },
          { label: section.title },
        ]}
      />
      <GuideSectionForm section={section} />
    </div>
  );
}
