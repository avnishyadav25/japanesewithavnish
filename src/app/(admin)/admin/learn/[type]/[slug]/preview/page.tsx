import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { getAdminSession } from "@/lib/auth/admin";
import { LEARN_CONTENT_TYPES, LEARN_TYPE_LABELS, type LearnContentType } from "@/lib/learn-filters";
import { LessonMetaContent } from "@/components/learn/LessonMetaContent";
import { LearnMarkdown } from "@/components/learn/LearnMarkdown";
import { reorderContentExamplesLast, boldContentLabels } from "@/lib/learn-content";

type Meta = Record<string, unknown> | null;

export default async function AdminLearnPreviewPage({
  params,
}: {
  params: Promise<{ type: string; slug: string }>;
}) {
  const admin = await getAdminSession();
  if (!admin) notFound();

  const { type, slug } = await params;
  const normalized = type.toLowerCase();
  if (!LEARN_CONTENT_TYPES.includes(normalized as LearnContentType)) notFound();

  if (!sql) notFound();
  const rows = await sql`
    SELECT id, title, content, jlpt_level, meta, status
    FROM learning_content
    WHERE content_type = ${normalized} AND slug = ${slug}
    LIMIT 1
  `;
  const item = rows[0] as {
    title: string;
    jlpt_level?: string | null;
    content?: string | null;
    meta?: Meta;
    status?: string;
  } | undefined;
  if (!item) notFound();

  const meta = (item.meta ?? {}) as Record<string, unknown>;
  const featureImageUrl = typeof meta.feature_image_url === "string" ? meta.feature_image_url : null;
  const contentStr = item.content != null ? String(item.content) : "";

  return (
    <div className="py-12 sm:py-16 px-4 sm:px-6 japanese-wave-bg">
      <div className="max-w-[800px] mx-auto">
        <div className="mb-6 p-3 rounded-bento bg-amber-100 border border-amber-300 text-amber-900 text-sm flex items-center justify-between gap-4">
          <span>Preview mode — only visible to admins</span>
          <Link href={`/admin/learn/${normalized}/${slug}/edit`} className="font-medium hover:underline">
            Edit →
          </Link>
        </div>
        <nav className="text-sm text-secondary mb-8 flex items-center gap-2">
          <Link href="/admin" className="hover:text-primary">Admin</Link>
          <span className="opacity-50">／</span>
          <Link href={`/admin/learn/${normalized}`} className="hover:text-primary">
            {LEARN_TYPE_LABELS[normalized as LearnContentType]}
          </Link>
          <span className="opacity-50">／</span>
          <span className="text-charcoal truncate max-w-[200px]">{item.title}</span>
        </nav>

        <article className="card-content japanese-shoji-border">
          <div className="flex items-center gap-2 mb-4">
            <span className="japanese-kanji-accent text-lg">{LEARN_TYPE_LABELS[normalized as LearnContentType]}</span>
            {item.jlpt_level && <span className="text-xs text-secondary">{item.jlpt_level}</span>}
            {item.status === "draft" && (
              <span className="text-xs px-2 py-0.5 rounded bg-amber-200 text-amber-900">Draft</span>
            )}
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-charcoal mb-6">
            {item.title}
          </h1>

          {featureImageUrl ? (
            <div className="rounded-bento overflow-hidden border border-[var(--divider)] mb-6 aspect-video max-w-full bg-[var(--divider)]/20">
              <img src={featureImageUrl} alt="" className="w-full h-full object-cover" />
            </div>
          ) : null}

          <LessonMetaContent contentType={normalized} meta={meta} />

          {contentStr ? (
            <div className="prose prose-charcoal max-w-none text-secondary mt-6">
              <LearnMarkdown content={boldContentLabels(reorderContentExamplesLast(contentStr))} meta={meta} contentType={normalized} />
            </div>
          ) : (
            <p className="text-secondary mt-6 italic">No main content yet.</p>
          )}
        </article>

        <div className="mt-8 flex gap-3">
          <Link href={`/admin/learn/${normalized}/${slug}/edit`} className="btn-primary">
            Edit
          </Link>
          <Link href={`/admin/learn/${normalized}`} className="btn-secondary">
            ← Back to list
          </Link>
        </div>
      </div>
    </div>
  );
}
