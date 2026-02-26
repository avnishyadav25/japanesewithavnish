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

  return (
    <div className="py-16 px-4 sm:px-6">
      <div className="max-w-[1100px] mx-auto">
        <h1 className="text-3xl font-bold text-charcoal mb-4">Blog</h1>
        <p className="text-secondary mb-12">
          Lessons, tips, and resources for your JLPT journey.
        </p>

        {posts && posts.length > 0 ? (
          <div className="grid gap-8">
            {posts.map((post) => (
              <article key={post.id} className="card">
                <Link href={`/blog/${post.slug}`} className="block hover:no-underline">
                  <h2 className="text-xl font-bold text-charcoal mb-2 hover:text-primary transition">
                    {post.title}
                  </h2>
                  {post.summary && (
                    <p className="text-secondary mb-2">{post.summary}</p>
                  )}
                  {post.published_at && (
                    <time className="text-sm text-secondary">
                      {new Date(post.published_at).toLocaleDateString()}
                    </time>
                  )}
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-secondary">No posts yet. Check back soon!</p>
        )}
      </div>
    </div>
  );
}
