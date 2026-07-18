import { notFound, redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { LEARN_CONTENT_TYPES, type LearnContentType } from "@/lib/learn-filters";
import { isLearnContent } from "@/lib/blog-filters";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { BlogPostForm } from "../../BlogPostForm";

export default async function AdminBlogsEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  // [slug] isn't the final path segment here (followed by "edit"), so Next.js
  // doesn't auto-decode it — non-ASCII slugs (old bookmarked learn-content
  // URLs) arrive still percent-encoded. Decode explicitly; harmless no-op otherwise.
  const slug = decodeURIComponent(rawSlug);
  if (!sql) notFound();

  const rows = await sql`
    SELECT id, slug, title, content, summary, (jlpt_level)[1] AS jlpt_level, jlpt_level AS jlpt_level_arr, tags, meta, status, sort_order, content_type, published_at, seo_title, seo_description, og_image_url, image_prompt, author_name
    FROM posts
    WHERE slug = ${slug}
    LIMIT 1
  `;
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) notFound();

  const contentType = row.content_type != null ? String(row.content_type) : null;
  const isLearn = contentType && isLearnContent(contentType);

  // Learn content types now have their own dedicated editor; keep this redirect
  // so old bookmarked /admin/blogs/{slug}/edit links still work.
  if (isLearn && LEARN_CONTENT_TYPES.includes(contentType as LearnContentType)) {
    // redirect() sets a raw HTTP Location header, which Node rejects outright
    // for non-ASCII bytes (unlike a JSX href, which the browser encodes for us)
    // — encode the slug explicitly so this doesn't crash for Unicode slugs.
    redirect(`/admin/learn/${contentType}/${encodeURIComponent(slug)}/edit`);
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
    author_name: row.author_name != null ? String(row.author_name) : null,
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
