import Link from "next/link";
import { sql } from "@/lib/db";
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

  let allPosts: Post[] = [];
  let pinnedByLevel: Record<string, string[]> = {};

  if (sql) {
    const [postsRows, settingsRows] = await Promise.all([
      sql`SELECT id, slug, title, summary, jlpt_level, tags, published_at FROM posts WHERE status = 'published' ORDER BY published_at DESC LIMIT 100`,
      sql`SELECT value FROM site_settings WHERE key = 'jlpt_pinned_posts' LIMIT 1`,
    ]);
    allPosts = (postsRows ?? []) as Post[];
    const settingsRow = (settingsRows[0] as { value: Record<string, string[]> | null } | undefined);
    pinnedByLevel = settingsRow?.value ?? {};
  }

  const initialPosts = filterPostsByLevel(allPosts, initialLevel);

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
