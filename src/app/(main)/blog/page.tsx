import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function BlogPage() {
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from("posts")
    .select("id, slug, title, summary, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(20);

  const items = posts && posts.length > 0 ? posts : [];

  return (
    <div className="py-12 sm:py-16 px-4 sm:px-6">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-10">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal mb-2">Blog</h1>
          <p className="text-secondary">Lessons, tips, and resources for your JLPT journey.</p>
        </div>

        {items.length > 0 ? (
          <div className="bento-grid">
            {items.map((post, i) => (
              <div
                key={post.id}
                className={i === 0 ? "bento-span-4 bento-row-2" : i === 1 ? "bento-span-2 bento-row-2" : "bento-span-2"}
              >
                <Link href={`/blog/${post.slug}`} className="card block h-full hover:no-underline group">
                  <h2 className="font-heading font-bold text-charcoal mb-2 group-hover:text-primary transition-colors">
                    {i === 0 ? post.title : post.title.length > 50 ? post.title.slice(0, 50) + "…" : post.title}
                  </h2>
                  {post.summary && (
                    <p className="text-secondary text-sm mb-2 line-clamp-2">{post.summary}</p>
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
        ) : (
          <div className="card bento-span-6 p-12 text-center">
            <p className="text-secondary">No posts yet. Check back soon!</p>
          </div>
        )}
      </div>
    </div>
  );
}
