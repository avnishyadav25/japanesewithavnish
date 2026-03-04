import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { ProductCard } from "@/components/ProductCard";
import { BlogCommentForm } from "@/components/BlogCommentForm";
import { BlogCommentList } from "@/components/BlogCommentList";
import { BlogStickyCta } from "@/components/blog/BlogStickyCta";
import { BlogTableOfContents } from "@/components/blog/BlogTableOfContents";
import { BlogArticleContent } from "@/components/blog/BlogArticleContent";
import { BlogNextStepCta } from "@/components/blog/BlogNextStepCta";
import { BlogPostCard } from "@/components/blog/BlogPostCard";
import { filterPosts, type PostForFilter } from "@/lib/blog-filters";
import { ContentAnalytics } from "@/components/ContentAnalytics";
import { ArticleSchema } from "@/components/JsonLd";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!sql) return {};
  const rows = await sql`
    SELECT title, seo_title, seo_description, og_image_url
    FROM posts WHERE slug = ${slug} AND status = 'published' LIMIT 1
  ` as { title: string; seo_title: string | null; seo_description: string | null; og_image_url: string | null }[];
  const p = rows[0];
  if (!p) return {};
  const title = p.seo_title?.trim() || p.title;
  const description = p.seo_description?.trim() || undefined;
  return {
    title: title ? `${title} | Japanese with Avnish` : undefined,
    description,
    openGraph: {
      title: title || undefined,
      description: description || undefined,
      images: p.og_image_url ? [{ url: p.og_image_url }] : undefined,
      type: "article",
      url: `${BASE}/blog/${slug}`,
    },
  };
}

function estimateReadTime(content: string): number {
  const text = content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!sql) notFound();

  const postRows = await sql`SELECT * FROM posts WHERE slug = ${slug} AND status = 'published' LIMIT 1`;
  const postRaw = postRows[0] as Record<string, unknown> | undefined;
  if (!postRaw) notFound();
  const post = postRaw as {
    id: string; title: string; summary?: string | null; seo_description?: string | null; content?: string | null;
    published_at?: string | null; og_image_url?: string | null; jlpt_level?: unknown; tags?: string[];
  };

  const jlptLevels = Array.isArray(post.jlpt_level)
    ? post.jlpt_level
    : post.jlpt_level
      ? [post.jlpt_level]
      : [];
  const primaryLevel = (jlptLevels[0] as string)?.toUpperCase?.() || "";
  const tags = (post.tags || []) as string[];
  const topicTag = tags[0] || "Article";

  const productRows = await sql`SELECT id, slug, name, price_paise, compare_price_paise, badge, jlpt_level, image_url, is_mega FROM products ORDER BY sort_order ASC`;
  const allProducts = (productRows || []) as { id: string; slug: string; name: string; price_paise: number; compare_price_paise?: number; badge?: string; jlpt_level?: string; image_url?: string; is_mega?: boolean }[];
  const relevantProducts = allProducts.filter(
    (p) =>
      p.jlpt_level === primaryLevel ||
      p.jlpt_level === "N4" ||
      p.is_mega ||
      (primaryLevel === "N5" && ["N5", "N4"].includes(p.jlpt_level || ""))
  );
  const bundlesToShow =
    relevantProducts.length > 0 ? relevantProducts.slice(0, 4) : allProducts.slice(0, 4);

  const allPostsRows = await sql`
    SELECT id, slug, title, summary, seo_description, published_at, og_image_url, jlpt_level, tags
    FROM posts WHERE status = 'published' AND id != ${post.id as string}
    ORDER BY published_at DESC LIMIT 50
  `;
  const related = filterPosts(
    (allPostsRows || []) as PostForFilter[],
    primaryLevel ? primaryLevel.toLowerCase() : "all",
    "all",
    ""
  ).slice(0, 6);

  const commentsRows = await sql`
    SELECT id, author_name, author_email, content, created_at
    FROM post_comments WHERE post_id = ${post.id as string} AND status = 'approved'
    ORDER BY created_at ASC
  `;
  const comments = (commentsRows || []) as { id: string; author_name: string; author_email: string; content: string; created_at: string }[];

  const contentStr = typeof post.content === "string" ? post.content : "";
  const readTime = contentStr ? estimateReadTime(contentStr) : 0;
  const isMarkdown = contentStr && !contentStr.trim().startsWith("<");

  const postUrl = `${BASE}/blog/${slug}`;
  return (
    <div className="py-12 sm:py-16 px-6 sm:px-8 lg:px-12 pb-24 lg:pb-16">
      <ArticleSchema
        title={post.title}
        description={post.seo_description || post.summary || undefined}
        url={postUrl}
        image={post.og_image_url || undefined}
        datePublished={post.published_at || undefined}
      />
      <ContentAnalytics content_type="blog" content_id={post.id as string} trackDuration />
      <div className="max-w-[1400px] mx-auto">
        <div className="grid lg:grid-cols-[1fr_280px] gap-8">
          <div>
            {/* Breadcrumb */}
            <nav className="text-sm text-secondary mb-6">
              <Link href="/" className="hover:text-primary">
                Home
              </Link>
              <span className="mx-2">/</span>
              <Link href="/blog" className="hover:text-primary">
                Blog
              </Link>
              {primaryLevel && (
                <>
                  <span className="mx-2">/</span>
                  <Link href={`/blog?level=${primaryLevel.toLowerCase()}`} className="hover:text-primary">
                    {primaryLevel}
                  </Link>
                </>
              )}
              <span className="mx-2">/</span>
              <span className="text-charcoal">{topicTag}</span>
            </nav>

            {/* Meta */}
            <div className="flex flex-wrap gap-4 text-secondary text-sm mb-6">
              {post.published_at && (
                <time>
                  {new Date(post.published_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
              )}
              {readTime > 0 && <span>{readTime} min read</span>}
              <div className="flex gap-2">
                {primaryLevel && (
                  <span className="px-2 py-0.5 rounded bg-base border border-[var(--divider)]">
                    {primaryLevel}
                  </span>
                )}
                {tags.slice(0, 2).map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded bg-base border border-[var(--divider)]"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Article header */}
            <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-charcoal mb-4">
              {post.title}
            </h1>

            {/* Featured image */}
            {post.og_image_url && (
              <div className="mb-8 rounded-[10px] overflow-hidden border border-[var(--divider)]">
                <img
                  src={post.og_image_url}
                  alt=""
                  className="w-full aspect-video object-cover object-top"
                />
              </div>
            )}

            {/* TOC + Article */}
            <div className="flex gap-8">
              {isMarkdown && (
                <aside className="hidden xl:block w-48 flex-shrink-0">
                  <BlogTableOfContents content={contentStr} />
                </aside>
              )}
              <div className="flex-1 min-w-0">
                <div className="prose prose-charcoal prose-lg max-w-none text-[1.5rem] [&_h1]:text-4xl [&_h1]:font-heading [&_h1]:font-bold [&_h2]:text-3xl [&_h2]:font-heading [&_h2]:font-bold [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-2xl [&_h3]:font-heading [&_h3]:font-bold [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:text-[1.5rem] [&_p]:leading-[1.7] [&_p]:mb-4 [&_ul]:mb-4 [&_ol]:mb-4 [&_li]:text-[1.5rem]">
                  {contentStr ? (
                    <BlogArticleContent content={contentStr} />
                  ) : null}
                </div>
              </div>
            </div>

            {/* Summary card (same style as Next Step CTA) — before "What should you do next?" */}
            {(post.summary || post.seo_description) && (
              <div className="card p-6 mt-12 text-center">
                <h3 className="font-heading font-bold text-charcoal text-xl mb-4">
                  Summary
                </h3>
                <p className="text-secondary leading-relaxed text-lg">
                  {post.summary || post.seo_description}
                </p>
              </div>
            )}

            {/* Next Step CTA */}
            <BlogNextStepCta />

            {/* Related posts */}
            {related.length > 0 && (
              <section className="mt-12 pt-10 border-t border-[var(--divider)]">
                <h2 className="font-heading text-2xl font-bold text-charcoal mb-6">
                  Recommended next reads
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {related.slice(0, 6).map((p) => (
                    <BlogPostCard key={p.id} post={p} size="small" />
                  ))}
                </div>
              </section>
            )}

            {/* Comments */}
            <section className="mt-12 pt-10 border-t border-[var(--divider)]">
              <h2 className="font-heading text-2xl font-bold text-charcoal mb-4">
                Comments
              </h2>
              <BlogCommentList comments={comments} />
              <div className="mt-6">
                <h3 className="font-heading text-lg font-semibold text-charcoal mb-3">
                  Add a comment
                </h3>
                <BlogCommentForm slug={slug} />
              </div>
            </section>

            {/* Recommended bundles */}
            {bundlesToShow.length > 0 && (
              <section className="mt-12 pt-10 border-t border-[var(--divider)]">
                <h2 className="font-heading text-2xl sm:text-3xl font-bold text-charcoal mb-2 text-center">
                  Recommended bundles for you
                </h2>
                <p className="text-secondary text-center mb-8 max-w-xl mx-auto">
                  Structured study materials to accelerate your JLPT journey.
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {bundlesToShow.map((product, i) => (
                    <ProductCard
                      key={product.id}
                      slug={product.slug}
                      name={product.name}
                      price={product.price_paise}
                      comparePrice={product.compare_price_paise ?? undefined}
                      badge={
                        product.badge === "premium"
                          ? "premium"
                          : product.badge === "offer"
                            ? "offer"
                            : undefined
                      }
                      jlptLevel={product.jlpt_level ?? undefined}
                      size="medium"
                      imageUrl={product.image_url}
                      index={i}
                    />
                  ))}
                </div>
                <div className="mt-6 text-center">
                  <Link href="/store" className="btn-primary inline-block">
                    Browse all bundles
                  </Link>
                </div>
              </section>
            )}
          </div>

          {/* Right sidebar: sticky CTA only */}
          <aside>
            <BlogStickyCta primaryLevel={primaryLevel} tags={tags} />
          </aside>
        </div>
      </div>
    </div>
  );
}
