import Link from "next/link";
import Image from "next/image";

interface Post {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  seo_description?: string | null;
  published_at?: string | null;
  og_image_url?: string | null;
}

export async function RecentBlogSection() {
  const { sql } = await import("@/lib/db");
  let items: Post[] = [];
  if (sql) {
    const rows = await sql`
      SELECT id, slug, title, summary, seo_description, published_at, og_image_url
      FROM posts WHERE status = 'published'
      ORDER BY published_at DESC LIMIT 6
    `;
    items = (rows ?? []) as Post[];
  }

  if (items.length === 0) return null;

  return (
    <section className="py-10 px-4 sm:py-[60px] sm:px-5 lg:px-6">
      <div className="max-w-[1200px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-heading text-2xl font-bold text-charcoal">From the blog</h2>
          <Link href="/blog" className="text-primary font-medium hover:underline text-sm">
            View all posts
          </Link>
        </div>
        <div className="bento-grid">
          {items.map((post, i) => (
            <div
              key={post.id}
              className={i === 0 ? "bento-span-4 bento-row-2" : i === 1 ? "bento-span-2 bento-row-2" : "bento-span-2"}
            >
              <Link
                href={`/blog/${post.slug}`}
                className="card block h-full hover:no-underline group overflow-hidden"
              >
                {post.og_image_url && (
                  <div className="mb-3 rounded-t-bento overflow-hidden aspect-video -mx-6 -mt-6 relative">
                    <Image
                      src={post.og_image_url}
                      alt=""
                      fill
                      className="object-cover object-top group-hover:scale-[1.02] transition-transform duration-300"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  </div>
                )}
                <h3 className="font-heading font-bold text-charcoal mb-2 group-hover:text-primary transition-colors">
                  {i === 0 ? post.title : post.title.length > 50 ? post.title.slice(0, 50) + "…" : post.title}
                </h3>
                {(post.seo_description || post.summary) && (
                  <p className="text-secondary text-sm mb-2 line-clamp-2">
                    {post.seo_description || post.summary}
                  </p>
                )}
                {post.published_at && (
                  <time className="text-xs text-secondary">
                    {new Date(post.published_at).toLocaleDateString()}
                  </time>
                )}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
