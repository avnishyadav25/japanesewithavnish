import Link from "next/link";

interface Post {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  jlpt_level?: string[] | null;
}

interface StartHereCuratedBlogProps {
  posts: Post[];
}

export function StartHereCuratedBlog({ posts }: StartHereCuratedBlogProps) {
  if (posts.length === 0) return null;

  return (
    <div>
      <h2 className="font-heading text-2xl font-bold text-charcoal mb-6">Start learning for free</h2>
      <div className="grid sm:grid-cols-3 gap-4">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/blog/${post.slug}`}
            className="card block hover:no-underline group p-5"
          >
            <h3 className="font-heading font-bold text-charcoal group-hover:text-primary transition-colors text-base mb-2 line-clamp-2">
              {post.title}
            </h3>
            {post.jlpt_level?.length ? (
              <span className="text-secondary text-xs font-medium uppercase tracking-wider">
                {post.jlpt_level[0]}
              </span>
            ) : null}
            {post.summary && (
              <p className="text-secondary text-sm mt-2 line-clamp-2">{post.summary}</p>
            )}
            <span className="inline-block mt-3 text-primary text-sm font-medium group-hover:underline">
              Read →
            </span>
          </Link>
        ))}
      </div>
      <Link href="/blog" className="inline-block mt-6 text-primary font-medium hover:underline text-sm">
        View all lessons →
      </Link>
    </div>
  );
}
