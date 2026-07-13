import Link from "next/link";
import { sql } from "@/lib/db";
import { filterPosts, type PostForFilter } from "@/lib/blog-filters";
import { BlogFilterBar } from "@/components/blog/BlogFilterBar";
import { BlogHeroWithSearch } from "@/components/blog/BlogHeroWithSearch";
import { BlogPostCard } from "@/components/blog/BlogPostCard";

const POSTS_PER_PAGE = 12;

export const dynamic = "force-dynamic";

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; type?: string; search?: string; page?: string }>;
}) {
  const params = await searchParams;
  const level = params.level || "all";
  const type = params.type || "all";
  const search = params.search || "";
  const page = Math.max(1, parseInt(params.page || "1", 10));

  let allPosts: PostForFilter[] = [];
  let featuredSlugs: string[] = [];

  if (sql) {
    try {
      const [postsRows, settingsRows] = await Promise.all([
        sql`SELECT id, slug, title, summary, seo_description, published_at, og_image_url, jlpt_level, tags, content_type, author_name FROM posts WHERE status = 'published' AND content_type IN ('blog', 'study_guide') ORDER BY published_at DESC LIMIT 200`,
        sql`SELECT value FROM site_settings WHERE key = 'blog_featured_posts' LIMIT 1`,
      ]);
      allPosts = (Array.isArray(postsRows) ? postsRows : []) as PostForFilter[];
      const settingsRow = (Array.isArray(settingsRows) ? settingsRows[0] : settingsRows) as { value?: string[] } | undefined;
      featuredSlugs = (settingsRow?.value && Array.isArray(settingsRow.value) ? settingsRow.value : []) as string[];
    } catch (err) {
      console.error("[Blog] Failed to fetch posts:", err);
    }
  }
  const filtered = filterPosts(allPosts, level, type, search);

  const featuredPosts = featuredSlugs.length >= 2
    ? featuredSlugs
        .slice(0, 2)
        .map((slug) => filtered.find((p) => p.slug === slug))
        .filter(Boolean) as PostForFilter[]
    : filtered.slice(0, 2);

  const showFeaturedRow = featuredPosts.length >= 2;
  const featuredIds = new Set(featuredPosts.map((p) => p.id));
  const restPosts = showFeaturedRow
    ? filtered.filter((p) => !featuredIds.has(p.id))
    : filtered;
  const totalPages = Math.ceil(restPosts.length / POSTS_PER_PAGE) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginated = restPosts.slice(
    (currentPage - 1) * POSTS_PER_PAGE,
    currentPage * POSTS_PER_PAGE
  );

  const baseQuery = new URLSearchParams();
  if (level !== "all") baseQuery.set("level", level);
  if (type !== "all") baseQuery.set("type", type);
  if (search) baseQuery.set("search", search);
  const queryStr = baseQuery.toString();

  return (
    <div className="py-12 sm:py-16 px-4 sm:px-6">
      <div className="max-w-[1200px] mx-auto">
        {/* Hero: title left, search + links top right */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-8">
          <div>
            <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal mb-2">
              Blog
            </h1>
            <p className="text-secondary">
              Lessons, tips, and resources for your JLPT journey.
            </p>
          </div>
          <BlogHeroWithSearch initialSearch={search} />
        </div>

        {/* Level + topic pills in one row (like Learn) */}
        <div className="card p-5 mb-8">
          <BlogFilterBar />
        </div>

        {filtered.length > 0 ? (
          <>
            {/* Featured row */}
            {showFeaturedRow && (
              <div className="bento-grid mb-10">
                <BlogPostCard post={featuredPosts[0]} size="featured" />
                <BlogPostCard post={featuredPosts[1]} size="medium" />
              </div>
            )}

            {/* Main grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
              {paginated.map((post) => (
                <BlogPostCard key={post.id} post={post} size="small" />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <nav className="flex justify-center gap-4 items-center mt-8 text-xs font-bold font-heading">
                <Link
                  href={
                    currentPage > 1
                      ? currentPage === 2
                        ? `/blog${queryStr ? `?${queryStr}` : ""}`
                        : `/blog?${new URLSearchParams({
                            ...Object.fromEntries(baseQuery),
                            page: String(currentPage - 1),
                          }).toString()}`
                      : "#"
                  }
                  className={`btn-secondary h-9 px-4 flex items-center justify-center rounded-xl ${
                    currentPage <= 1 ? "opacity-40 cursor-not-allowed pointer-events-none" : ""
                  }`}
                >
                  ← Previous
                </Link>
                <span className="text-secondary">
                  Page {currentPage} of {totalPages}
                </span>
                <Link
                  href={
                    currentPage < totalPages
                      ? `/blog?${new URLSearchParams({
                          ...Object.fromEntries(baseQuery),
                          page: String(currentPage + 1),
                        }).toString()}`
                      : "#"
                  }
                  className={`btn-secondary h-9 px-4 flex items-center justify-center rounded-xl ${
                    currentPage >= totalPages ? "opacity-40 cursor-not-allowed pointer-events-none" : ""
                  }`}
                >
                  Next →
                </Link>
              </nav>
            )}
          </>
        ) : (
          <div className="card p-12 text-center bg-white border border-[var(--divider)] rounded-3xl">
            <p className="text-secondary text-sm">No blog posts found matching your filters.</p>
            <Link href="/blog" className="text-primary font-bold mt-2 inline-block hover:underline">
              Clear filters →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
