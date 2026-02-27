import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { JLPTContent } from "@/components/jlpt/JLPTContent";
import { JLPT_LEVELS, type JLPTLevel } from "@/data/jlpt-levels";

type Post = {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  jlpt_level?: string[] | null;
  tags?: string[] | null;
  published_at?: string | null;
};

function filterPostsByLevel(posts: Post[], level: JLPTLevel): Post[] {
  const levels = (l: unknown): string[] =>
    Array.isArray(l) ? l.map((x) => String(x).toUpperCase()) : l ? [String(l).toUpperCase()] : [];
  return posts.filter((p) => {
    const postLevels = levels(p.jlpt_level);
    if (level === "mega") {
      return postLevels.some((pl) => ["N5", "N4", "N3", "N2", "N1"].includes(pl));
    }
    return postLevels.includes(level.toUpperCase());
  });
}

export default async function JLPTPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string }>;
}) {
  const { level: levelParam } = await searchParams;
  const initialLevel: JLPTLevel =
    levelParam && JLPT_LEVELS.includes(levelParam.toLowerCase() as JLPTLevel)
      ? (levelParam.toLowerCase() as JLPTLevel)
      : "n5";

  const supabase = await createClient();

  const [postsRes, settingsRes] = await Promise.all([
    supabase
      .from("posts")
      .select("id, slug, title, summary, jlpt_level, tags, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(100),
    supabase
      .from("site_settings")
      .select("key, value")
      .eq("key", "jlpt_pinned_posts")
      .maybeSingle(),
  ]);

  const allPosts = (postsRes.data ?? []) as Post[];
  const initialPosts = filterPostsByLevel(allPosts, initialLevel);

  const pinnedByLevel = (settingsRes.data?.value as Record<string, string[]> | null) ?? {};

  return (
    <div className="py-12 sm:py-16 px-4 sm:px-6">
      <div className="max-w-[1200px] mx-auto">
        <nav className="text-sm text-secondary mb-8">
          <Link href="/" className="hover:text-primary">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-charcoal">JLPT</span>
        </nav>

        {/* Hero */}
        <section className="mb-10">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal mb-4">
            JLPT Levels (N5 → N1)
          </h1>
          <p className="text-secondary mb-6 max-w-2xl">
            Choose your level to get structured lessons, practice guidance, and the
            right bundle.
          </p>
          <div className="flex flex-wrap gap-3 mb-4">
            <Link href="/quiz" className="btn-primary">
              Take the Placement Quiz
            </Link>
            <Link
              href="/product/complete-japanese-n5-n1-mega-bundle"
              className="btn-secondary"
            >
              View Mega Bundle
            </Link>
          </div>
          <p className="text-secondary text-sm">
            Instant download • Lifetime access • Study offline
          </p>
        </section>

        {/* Tabs + Content */}
        <JLPTContent
          initialLevel={initialLevel}
          initialPosts={initialPosts}
          pinnedByLevel={pinnedByLevel}
        />
      </div>
    </div>
  );
}
