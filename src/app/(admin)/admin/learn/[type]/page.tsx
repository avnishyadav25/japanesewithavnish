import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { LEARN_CONTENT_TYPES, LEARN_TYPE_LABELS, type LearnContentType } from "@/lib/learn-filters";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { GenerateLearnListButton } from "@/components/admin/GenerateLearnListButton";
import { LearnContentRowActions } from "@/components/admin/LearnContentRowActions";

export default async function AdminLearnPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const normalized = type.toLowerCase();
  if (!LEARN_CONTENT_TYPES.includes(normalized as LearnContentType)) notFound();

  type Row = { id: string; slug: string; title: string; jlpt_level: string | null; status: string; sort_order: number; meta: Record<string, unknown> | null };
  let items: Row[] = [];
  if (sql) {
    const rows = await sql`
      SELECT id, slug, title, jlpt_level, status, sort_order, meta
      FROM learning_content WHERE content_type = ${normalized}
      ORDER BY sort_order, created_at DESC
    `;
    items = (rows ?? []) as Row[];
  }
  const featureImageUrl = (meta: Record<string, unknown> | null) =>
    meta && typeof meta.feature_image_url === "string" ? meta.feature_image_url : null;

  return (
    <div>
      <AdminPageHeader
        title={LEARN_TYPE_LABELS[normalized as LearnContentType]}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Learning" },
        ]}
        action={{ label: "Add", href: `/admin/learn/${normalized}/new` }}
      />
      <div className="mb-4">
        <GenerateLearnListButton
          contentType={normalized}
          existingItems={items.map((i) => ({ slug: i.slug, title: i.title }))}
        />
      </div>
      {items.length > 0 ? (
        <AdminCard>
          <AdminTable headers={["Image", "Title", "JLPT", "Status", "Actions"]}>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-[var(--divider)]">
                <td className="py-2 px-2">
                  {featureImageUrl(item.meta) ? (
                    <div className="w-10 h-10 rounded overflow-hidden border border-[var(--divider)] bg-[var(--divider)]/20 flex-shrink-0">
                      <img src={featureImageUrl(item.meta)!} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <span className="text-secondary text-xs">—</span>
                  )}
                </td>
                <td className="py-2 px-2 font-medium text-charcoal">{item.title}</td>
                <td className="py-2 px-2 text-secondary text-sm">{item.jlpt_level ?? "—"}</td>
                <td className="py-2 px-2">
                  <StatusBadge
                    status={item.status}
                    variant={item.status === "published" ? "published" : "draft"}
                  />
                </td>
                <td className="py-2 px-2">
                  <LearnContentRowActions contentType={normalized} slug={item.slug} status={item.status} />
                </td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      ) : (
        <AdminEmptyState
          message={`No ${LEARN_TYPE_LABELS[normalized as LearnContentType].toLowerCase()} content yet.`}
          action={{ label: "Add", href: `/admin/learn/${normalized}/new` }}
        />
      )}
    </div>
  );
}
