import Link from "next/link";
import { sql } from "@/lib/db";
import { StartHereAnnouncement } from "@/components/StartHereAnnouncement";
import { StartHereCuratedBlog } from "@/components/StartHereCuratedBlog";
import { HomeFaq } from "@/components/HomeFaq";

const LEVELS = ["N5", "N4", "N3", "N2", "N1"] as const;

export default async function StartHerePage() {
  const settings: Record<string, unknown> = {};
  let allPosts: { id: string; slug: string; title: string; summary?: string | null; jlpt_level?: string[] | null }[] = [];

  if (sql) {
    const [settingsRows, postsRows] = await Promise.all([
      sql`SELECT key, value FROM site_settings WHERE key = ANY(ARRAY['start_here_announcement', 'start_here_curated_posts', 'start_here_faq'])`,
      sql`SELECT id, slug, title, summary, jlpt_level FROM posts WHERE status = 'published' AND (content_type IS NULL OR content_type = 'blog')`,
    ]);
    (settingsRows as { key: string; value: unknown }[]).forEach((r) => { settings[r.key] = r.value; });
    allPosts = (postsRows as typeof allPosts) ?? [];
  }

  const announcement = settings.start_here_announcement as { enabled?: boolean; message?: string; href?: string } | null;
  const curatedSlugs = settings.start_here_curated_posts as string[] | null;
  const faqItems = settings.start_here_faq as { q: string; a: string }[] | null;

  let curatedPosts: typeof allPosts = [];
  if (Array.isArray(curatedSlugs) && curatedSlugs.length > 0) {
    curatedPosts = curatedSlugs
      .map((slug) => allPosts.find((p) => p.slug === slug))
      .filter(Boolean) as typeof allPosts;
  }
  if (curatedPosts.length === 0) {
    curatedPosts = allPosts.slice(0, 3);
  }

  return (
    <div className="bg-[#FAF8F5]">
      <StartHereAnnouncement config={announcement} />

      {/* Hero */}
      <section className="py-10 px-4 sm:py-[60px] sm:px-5 lg:px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal mb-4">
                Start Here
              </h1>
              <p className="text-secondary mb-6 max-w-xl">
                Whether you&apos;re starting from zero or aiming for JLPT N1, this page helps you find your level and start learning fast.
              </p>
              <div className="flex flex-wrap gap-3 mb-4">
                <Link href="/quiz" className="btn-primary">
                  Take the Placement Quiz
                </Link>
                <Link href="/pricing" className="btn-secondary">
                  View Premium Plans
                </Link>
              </div>
              <p className="text-secondary text-sm">Learn online, at your own pace, and keep your progress.</p>
            </div>
            <div className="card p-5">
              <h3 className="font-heading font-bold text-charcoal mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Link href="/quiz" className="flex items-center gap-2 text-charcoal hover:text-primary font-medium transition-colors">
                  <span>✅</span> Take Quiz (Recommended)
                </Link>
                <Link href="/login" className="flex items-center gap-2 text-charcoal hover:text-primary font-medium transition-colors">
                  <span>👤</span> Create your free account
                </Link>
                <Link href="/learn" className="flex items-center gap-2 text-charcoal hover:text-primary font-medium transition-colors">
                  <span>📚</span> Explore Premium
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3-Step Cards */}
      <section className="py-10 px-4 sm:py-[60px] sm:px-5 lg:px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="card p-6">
              <span className="text-4xl font-bold text-primary mb-3 block">1</span>
              <h2 className="font-heading font-bold text-charcoal mb-2">Find Your Level</h2>
              <p className="text-secondary text-sm mb-4">
                Not sure where to start? Take the 5-minute quiz. We&apos;ll recommend the right JLPT level and learning path.
              </p>
              <Link href="/quiz" className="btn-primary">Take the Quiz</Link>
            </div>
            <div className="card p-6">
              <span className="text-4xl font-bold text-primary mb-3 block">2</span>
              <h2 className="font-heading font-bold text-charcoal mb-2">Create Your Free Account</h2>
              <p className="text-secondary text-sm mb-4">
                Sign up for free to unlock daily lessons and track your progress. Upgrade anytime for unlimited access.
              </p>
              <Link href="/login" className="btn-secondary">Create your free account</Link>
            </div>
            <div className="card p-6">
              <span className="text-4xl font-bold text-primary mb-3 block">3</span>
              <h2 className="font-heading font-bold text-charcoal mb-2">Start Learning</h2>
              <p className="text-secondary text-sm mb-4">
                Log in anytime to continue your structured curriculum, right where you left off.
              </p>
              <Link href="/learn/dashboard" className="text-primary font-medium hover:underline">Go to Dashboard →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Recommended JLPT level and learning path */}
      <section className="py-10 px-4 sm:py-[60px] sm:px-5 lg:px-6">
        <div className="max-w-[1200px] mx-auto">
          <h2 className="font-heading text-2xl font-bold text-charcoal mb-2">Recommended JLPT level and learning path</h2>
          <p className="text-secondary text-sm mb-8">Not sure which level fits you? Take the quiz above, or jump straight into a level below.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {LEVELS.map((level) => (
              <Link
                key={level}
                href="/learn"
                className="card p-5 text-center hover:shadow-hover transition-shadow"
              >
                <span className="font-heading text-xl font-bold text-charcoal">{level}</span>
                <p className="text-secondary text-xs mt-1">Included with Premium access</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Curated Blog */}
      {curatedPosts.length > 0 && (
        <section className="py-10 px-4 sm:py-[60px] sm:px-5 lg:px-6">
          <div className="max-w-[1200px] mx-auto">
            <StartHereCuratedBlog posts={curatedPosts} />
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="py-10 px-4 sm:py-[60px] sm:px-5 lg:px-6">
        <div className="max-w-[1200px] mx-auto">
          <HomeFaq items={faqItems} />
        </div>
      </section>
    </div>
  );
}
