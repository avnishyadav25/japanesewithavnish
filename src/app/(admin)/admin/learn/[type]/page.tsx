import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

const TYPES = ["grammar", "vocabulary", "kanji", "reading", "writing"] as const;
const TYPE_LABELS: Record<string, string> = {
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  kanji: "Kanji",
  reading: "Reading",
  writing: "Writing",
};

export default async function AdminLearnPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const normalized = type.toLowerCase();
  if (!TYPES.includes(normalized as (typeof TYPES)[number])) notFound();

  let items: { id: string; slug: string; title: string; jlpt_level: string | null; status: string; sort_order: number }[] = [];
  if (sql) {
    const rows = await sql`
      SELECT id, slug, title, jlpt_level, status, sort_order
      FROM learning_content WHERE content_type = ${normalized}
      ORDER BY sort_order, created_at DESC
    `;
    items = (rows ?? []) as typeof items;
  }

  return (
    <div>
      <AdminPageHeader
        title={TYPE_LABELS[normalized]}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Learning" },
        ]}
        action={{ label: "Add", href: `/admin/learn/${normalized}/new` }}
      />
      {items.length > 0 ? (
        <AdminCard>
          <AdminTable headers={["Title", "JLPT", "Status", "Actions"]}>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-[var(--divider)]">
                <td className="py-2 px-2 font-medium text-charcoal">{item.title}</td>
                <td className="py-2 px-2 text-secondary text-sm">{item.jlpt_level ?? "—"}</td>
                <td className="py-2 px-2">
                  <StatusBadge
                    status={item.status}
                    variant={item.status === "published" ? "published" : "draft"}
                  />
                </td>
                <td className="py-2 px-2">
                  <Link
                    href={`/admin/learn/${normalized}/${item.slug}/edit`}
                    className="text-primary text-sm hover:underline mr-3"
                  >
                    Edit
                  </Link>
                  {item.status === "published" && (
                    <Link
                      href={`/learn/${normalized}/${item.slug}`}
                      className="text-primary text-sm hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      ) : (
        <AdminEmptyState
          message={`No ${TYPE_LABELS[normalized].toLowerCase()} content yet.`}
          action={{ label: "Add", href: `/admin/learn/${normalized}/new` }}
        />
      )}
    </div>
  );
}
