import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { LEARN_CONTENT_TYPES, type LearnContentType } from "@/lib/learn-filters";
import { LearnEditPageActions } from "@/components/admin/LearnEditPageActions";
import { LearningContentForm } from "../../../LearningContentForm";

export default async function AdminLearnEditPage({
  params,
}: {
  params: Promise<{ type: string; slug: string }>;
}) {
  const { type, slug } = await params;
  const normalized = type.toLowerCase();
  if (!LEARN_CONTENT_TYPES.includes(normalized as LearnContentType)) notFound();

  if (!sql) notFound();
  const rows = await sql`
    SELECT id, slug, title, content, jlpt_level, tags, meta, status, sort_order
    FROM learning_content
    WHERE content_type = ${normalized} AND slug = ${slug} LIMIT 1
  `;
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) notFound();

  const item: {
    id: string;
    slug: string;
    title: string;
    content: string | null;
    jlpt_level: string | null;
    tags: string[];
    meta: Record<string, unknown>;
    status: string;
    sort_order: number;
  } = {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title ?? ""),
    content: row.content != null ? String(row.content) : null,
    jlpt_level: row.jlpt_level != null ? String(row.jlpt_level) : null,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    meta: row.meta != null && typeof row.meta === "object" ? (row.meta as Record<string, unknown>) : {},
    status: String(row.status ?? "draft"),
    sort_order: Number(row.sort_order) ?? 0,
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <nav className="text-sm text-secondary mb-2 flex items-center gap-2">
            <Link href="/admin" className="hover:text-primary transition">Admin</Link>
            <span className="opacity-50">／</span>
            <Link href={`/admin/learn/${normalized}`} className="hover:text-primary transition">Learning</Link>
            <span className="opacity-50">／</span>
            <span className="text-charcoal truncate max-w-[200px]">{item.title as string}</span>
          </nav>
          <h1 className="font-heading text-2xl font-bold text-charcoal">{`Edit ${item.title as string}`}</h1>
        </div>
        <LearnEditPageActions contentType={normalized} slug={slug} status={String(item.status ?? "draft")} />
      </div>
      <LearningContentForm contentType={normalized} item={item} />
    </div>
  );
}
