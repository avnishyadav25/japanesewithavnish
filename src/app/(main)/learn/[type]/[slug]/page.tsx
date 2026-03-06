import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import {
  LEARN_CONTENT_TYPES,
  LEARN_TYPE_LABELS,
  type LearnContentType,
  type LearnItemForFilter,
} from "@/lib/learn-filters";
import { LessonMetaContent } from "@/components/learn/LessonMetaContent";
import { LearnLessonCard } from "@/components/learn/LearnLessonCard";
import { ProductCard } from "@/components/ProductCard";
import { BlogCommentList } from "@/components/BlogCommentList";
import { LearnCommentForm } from "@/components/learn/LearnCommentForm";
import { LearnMarkdown } from "@/components/learn/LearnMarkdown";
import { LearnStickyCta } from "@/components/learn/LearnStickyCta";
import { BlogTableOfContents } from "@/components/blog/BlogTableOfContents";
import { BlogNextStepCta } from "@/components/blog/BlogNextStepCta";
import { reorderContentExamplesLast, boldContentLabels } from "@/lib/learn-content";

type Meta = Record<string, unknown> | null;

export default async function LearnDetailPage({
  params,
}: {
  params: Promise<{ type: string; slug: string }>;
}) {
  const { type, slug } = await params;
  const normalized = type.toLowerCase();

  if (!LEARN_CONTENT_TYPES.includes(normalized as LearnContentType)) notFound();

  if (!sql) notFound();
  const rows = await sql`
    SELECT * FROM learning_content
    WHERE content_type = ${normalized} AND slug = ${slug} AND status = 'published'
    LIMIT 1
  `;
  const item = rows[0] as {
    id: string;
    title: string;
    slug: string;
    content_type: string;
    jlpt_level?: string | null;
    content?: string | null;
    meta?: Meta;
    tags?: string[] | null;
    sort_order?: number;
    created_at?: string | null;
    updated_at?: string | null;
  } | undefined;
  if (!item) notFound();

  const meta = (item.meta ?? {}) as Record<string, unknown>;
  const featureImageUrl = typeof meta.feature_image_url === "string" ? meta.feature_image_url : null;
  const primaryLevel = (item.jlpt_level || "").toUpperCase();

  let related: LearnItemForFilter[] = [];
  let comments: { id: string; author_name: string; author_email: string; content: string; created_at: string }[] = [];
  let allProducts: { id: string; slug: string; name: string; price_paise: number; compare_price_paise?: number; badge?: string; jlpt_level?: string; image_url?: string; is_mega?: boolean }[] = [];

  const [relatedRows, productRows] = await Promise.all([
    sql`
      SELECT id, slug, title, content, content_type, jlpt_level, tags, meta, status, sort_order, created_at, updated_at
      FROM learning_content
      WHERE content_type = ${normalized} AND status = 'published' AND slug != ${slug}
      ORDER BY sort_order ASC, created_at DESC
      LIMIT 6
    `,
    sql`SELECT id, slug, name, price_paise, compare_price_paise, badge, jlpt_level, image_url, is_mega FROM products ORDER BY sort_order ASC`,
  ]);

  related = (Array.isArray(relatedRows) ? relatedRows : []) as LearnItemForFilter[];
  allProducts = (Array.isArray(productRows) ? productRows : []) as typeof allProducts;

  try {
    const commentsRows = await sql`
      SELECT id, author_name, author_email, content, created_at
      FROM learning_content_comments
      WHERE learning_content_id = ${item.id} AND status = 'approved'
      ORDER BY created_at ASC
    `;
    comments = (Array.isArray(commentsRows) ? commentsRows : []) as typeof comments;
  } catch {
    comments = [];
  }
  const relevantProducts = allProducts.filter(
    (p) =>
      p.jlpt_level === primaryLevel ||
      p.jlpt_level === "N4" ||
      p.is_mega ||
      (primaryLevel === "N5" && ["N5", "N4"].includes(p.jlpt_level || ""))
  );
  const bundlesToShow = relevantProducts.length > 0 ? relevantProducts.slice(0, 4) : allProducts.slice(0, 4);
  const contentStr = item.content ?? "";
  const reorderedContent = contentStr ? reorderContentExamplesLast(contentStr) : "";
  const contentWithBoldLabels = reorderedContent ? boldContentLabels(reorderedContent) : "";
  const hasToc = reorderedContent.includes("## ");

  return (
    <div className="py-12 sm:py-16 px-6 sm:px-8 lg:px-12 pb-24 lg:pb-16">
      <div className="max-w-[1400px] mx-auto">
        <div className="grid lg:grid-cols-[1fr_280px] gap-8">
          <div>
            {/* Breadcrumb — same style as blog */}
            <nav className="text-sm text-secondary mb-6">
              <Link href="/" className="hover:text-primary">Home</Link>
              <span className="mx-2">/</span>
              <Link href="/learn" className="hover:text-primary">Learn</Link>
              <span className="mx-2">/</span>
              <Link href={`/learn/${normalized}`} className="hover:text-primary">
                {LEARN_TYPE_LABELS[normalized as LearnContentType]}
              </Link>
              <span className="mx-2">/</span>
              <span className="text-charcoal truncate max-w-[200px]">{item.title}</span>
            </nav>

            {/* Meta row — same as blog */}
            <div className="flex flex-wrap gap-4 text-secondary text-sm mb-6">
              {item.jlpt_level && (
                <span className="px-2 py-0.5 rounded bg-base border border-[var(--divider)]">
                  {item.jlpt_level}
                </span>
              )}
              {Array.isArray(item.tags) && item.tags.length > 0 && (
                <div className="flex gap-2">
                  {item.tags.slice(0, 2).map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded bg-base border border-[var(--divider)]">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Article header */}
            <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-charcoal mb-4">
              {item.title}
            </h1>

            {/* Featured image — same as blog (full width, rounded) */}
            {featureImageUrl && (
              <div className="mb-8 rounded-[10px] overflow-hidden border border-[var(--divider)]">
                <img
                  src={featureImageUrl}
                  alt=""
                  className="w-full aspect-video object-cover object-top"
                />
              </div>
            )}

           

            {/* TOC + Article body — same layout as blog */}
            <div className="flex gap-8">
              {hasToc && (
                <aside className="hidden xl:block w-48 flex-shrink-0">
                  <BlogTableOfContents content={reorderedContent} />
                </aside>
              )}
              <div className="flex-1 min-w-0">
                {contentWithBoldLabels ? (
                  <div className="prose prose-charcoal prose-lg max-w-none text-secondary text-[1.5rem] [&_h1]:text-4xl [&_h1]:font-heading [&_h1]:!font-bold [&_h2]:text-3xl [&_h2]:font-heading [&_h2]:!font-bold [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-2xl [&_h3]:font-heading [&_h3]:!font-bold [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:text-[1.5rem] [&_p]:leading-[1.7] [&_p]:mb-4 [&_ul]:mb-4 [&_ol]:mb-4 [&_li]:text-[1.5rem] [&_li]:leading-[1.7] [&_blockquote]:text-[1.5rem] [&_blockquote]:leading-[1.7] [&_td]:text-[1.5rem] [&_strong]:text-[1.5rem]">
                    <LearnMarkdown content={contentWithBoldLabels} meta={meta} contentType={normalized} />
                  </div>
                ) : null}
              </div>
            </div>

            <LessonMetaContent contentType={normalized} meta={meta} />

            {/* Next step CTA — same as blog */}
            <BlogNextStepCta />

            {/* Related lessons — same section style as blog */}
            {related.length > 0 && (
              <section className="mt-12 pt-10 border-t border-[var(--divider)]">
                <h2 className="font-heading text-2xl font-bold text-charcoal mb-6">
                  Recommended next lessons
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {related.map((r) => (
                    <LearnLessonCard key={r.id} item={r} />
                  ))}
                </div>
              </section>
            )}

            {/* Comments — same as blog */}
            <section className="mt-12 pt-10 border-t border-[var(--divider)]">
              <h2 className="font-heading text-2xl font-bold text-charcoal mb-4">Comments</h2>
              <BlogCommentList comments={comments} />
              <div className="mt-6">
                <h3 className="font-heading text-lg font-semibold text-charcoal mb-3">Add a comment</h3>
                <LearnCommentForm contentType={normalized} slug={slug} />
              </div>
            </section>

            {/* Recommended bundles — same as blog */}
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

          {/* Right sidebar — sticky CTA like blog */}
          <aside>
            <LearnStickyCta contentType={normalized} primaryLevel={primaryLevel} />
          </aside>
        </div>
      </div>
    </div>
  );
}
