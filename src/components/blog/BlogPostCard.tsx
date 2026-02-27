import Link from "next/link";

type Post = {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  seo_description?: string | null;
  jlpt_level?: string[] | unknown;
  tags?: string[] | null;
  published_at?: string | null;
  og_image_url?: string | null;
};

interface BlogPostCardProps {
  post: Post;
  size?: "featured" | "medium" | "small";
}

const levels = (l: unknown): string[] =>
  Array.isArray(l) ? l.map((x) => String(x)) : l ? [String(l)] : [];

export function BlogPostCard({ post, size = "small" }: BlogPostCardProps) {
  const jlptTags = levels(post.jlpt_level);
  const topicTags = (post.tags || []).slice(0, 2);
  const primaryLevel = jlptTags[0];
  const displayTags = primaryLevel ? [primaryLevel, ...topicTags.filter((t) => t !== primaryLevel)] : topicTags;

  const isFeatured = size === "featured";
  const isMedium = size === "medium";

  return (
    <Link
      href={`/blog/${post.slug}`}
      className={`card block h-full hover:no-underline group overflow-hidden ${
        isFeatured ? "bento-span-4 bento-row-2" : isMedium ? "bento-span-2 bento-row-2" : ""
      }`}
    >
      {post.og_image_url && (
        <div
          className={`overflow-hidden rounded-t-[10px] -mx-6 -mt-6 ${
            isFeatured || isMedium ? "aspect-video mb-4" : "aspect-video mb-3"
          }`}
        >
          <img
            src={post.og_image_url}
            alt=""
            className="w-full h-full object-cover object-top group-hover:scale-[1.02] transition-transform duration-300"
          />
        </div>
      )}
      <h2
        className={`font-heading font-bold text-charcoal mb-2 group-hover:text-primary transition-colors ${
          isFeatured ? "text-xl sm:text-2xl" : isMedium ? "text-lg" : "text-base"
        }`}
      >
        <span className={isFeatured || isMedium ? "" : "line-clamp-2"}>
          {post.title}
        </span>
      </h2>
      {(post.seo_description || post.summary) && (
        <p className="text-secondary text-sm mb-2 line-clamp-2">
          {post.seo_description || post.summary}
        </p>
      )}
      <div className="flex flex-wrap gap-2 mb-2">
        {displayTags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 rounded text-xs bg-base border border-[var(--divider)] text-secondary"
          >
            {tag}
          </span>
        ))}
      </div>
      {post.published_at && (
        <time className="text-xs text-secondary block mb-2">
          {new Date(post.published_at).toLocaleDateString()}
        </time>
      )}
      <span className="text-primary text-sm font-medium">Read →</span>
    </Link>
  );
}
