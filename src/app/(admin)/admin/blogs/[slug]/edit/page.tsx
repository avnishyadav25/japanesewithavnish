import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { LEARN_CONTENT_TYPES, type LearnContentType } from "@/lib/learn-filters";
import { isLearnContent } from "@/lib/blog-filters";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { LearnEditPageActions } from "@/components/admin/LearnEditPageActions";
import { BlogPostForm } from "../../BlogPostForm";
import { LearningContentForm } from "@/app/(admin)/admin/learn/LearningContentForm";

export default async function AdminBlogsEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!sql) notFound();

  const rows = await sql`
    SELECT id, slug, title, content, summary, (jlpt_level)[1] AS jlpt_level, jlpt_level AS jlpt_level_arr, tags, meta, status, sort_order, content_type, published_at, seo_title, seo_description, og_image_url, image_prompt
    FROM posts
    WHERE slug = ${slug}
    LIMIT 1
  `;
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) notFound();

  const contentType = row.content_type != null ? String(row.content_type) : null;
  const isLearn = contentType && isLearnContent(contentType);

  if (isLearn && LEARN_CONTENT_TYPES.includes(contentType as LearnContentType)) {
    const item = {
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
              <Link href="/admin/blogs" className="hover:text-primary transition">Blogs</Link>
              <span className="opacity-50">／</span>
              <span className="text-charcoal truncate max-w-[200px]">{item.title}</span>
            </nav>
            <h1 className="font-heading text-2xl font-bold text-charcoal">{`Edit ${item.title}`}</h1>
          </div>
          <LearnEditPageActions
            contentType={contentType}
            slug={slug}
            status={item.status}
            redirectAfterDelete="/admin/blogs"
          />
        </div>
        <LearningContentForm contentType={contentType} item={item} editBasePath="blogs" />
      </div>
    );
  }

  // Blog post (content_type null or 'blog')
  const jlptArr = row.jlpt_level_arr;
  const post: Parameters<typeof BlogPostForm>[0]["post"] = {
    id: row.id != null ? String(row.id) : undefined,
    slug: String(row.slug ?? ""),
    title: String(row.title ?? ""),
    summary: String(row.summary ?? ""),
    content: String(row.content ?? ""),
    jlpt_level: Array.isArray(jlptArr) ? jlptArr.map(String) : jlptArr != null ? [String(jlptArr)] : null,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : null,
    status: String(row.status ?? "draft"),
    published_at: row.published_at != null ? String(row.published_at) : null,
    seo_title: String(row.seo_title ?? ""),
    seo_description: String(row.seo_description ?? ""),
    og_image_url: row.og_image_url != null ? String(row.og_image_url) : null,
    image_prompt: row.image_prompt != null ? String(row.image_prompt) : null,
  };

  return (
    <div>
      <AdminPageHeader
        title="Edit post"
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Blogs", href: "/admin/blogs" },
          { label: String(row.title ?? slug) },
        ]}
        actions={[
          { label: "Social generator", href: `/admin/social/prepare?type=blog&slug=${encodeURIComponent(slug)}` },
        ]}
      />
      <BlogPostForm post={post} />
    </div>
  );
}
