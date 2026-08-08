import Link from "next/link";
import { sql } from "@/lib/db";
import { clampTitle, clampDescription, canonicalUrl } from "@/lib/seo";
import { BreadcrumbListSchema } from "@/components/JsonLd";

const TITLE = clampTitle("All Badges & Achievements | Japanese with Avnish");
const DESCRIPTION = clampDescription(
  "Browse every badge you can earn on Japanese with Avnish — streaks, JLPT level milestones, skill badges, and special achievements."
);
const PATH = "/badges";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { title: TITLE, description: DESCRIPTION, url: canonicalUrl(PATH), type: "website", images: ["/og-default.png"] },
};

type Badge = {
  id: string;
  name: string;
  slug: string;
  description: string;
  emoji: string | null;
  color: string | null;
  category: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  streak: "Streak Badges",
  level: "JLPT Level Badges",
  skill: "Skill Badges",
  milestone: "Milestone Badges",
  special: "Special Badges",
};

const CATEGORY_ORDER = ["streak", "level", "skill", "milestone", "special"];

export default async function BadgesPage() {
  const rows = sql
    ? ((await sql`
        SELECT id, name, slug, description, emoji, color, category
        FROM badges
        WHERE is_active = true
        ORDER BY category ASC, name ASC
      `) as Badge[])
    : [];

  const byCategory = new Map<string, Badge[]>();
  for (const b of rows) {
    const list = byCategory.get(b.category) ?? [];
    list.push(b);
    byCategory.set(b.category, list);
  }
  const orderedCategories = [
    ...CATEGORY_ORDER.filter((c) => byCategory.has(c)),
    ...Array.from(byCategory.keys()).filter((c) => !CATEGORY_ORDER.includes(c)),
  ];

  return (
    <div className="min-h-screen bg-[var(--base)] py-12 px-4">
      <BreadcrumbListSchema
        items={[
          { name: "Home", url: canonicalUrl("/") },
          { name: "Badges", url: canonicalUrl(PATH) },
        ]}
      />
      <div className="max-w-[1000px] mx-auto">
        <nav className="text-sm text-secondary mb-8">
          <Link href="/" className="hover:text-primary">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-charcoal">Badges</span>
        </nav>

        <header className="mb-10">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal mb-3">
            All Badges &amp; Achievements
          </h1>
          <p className="text-secondary max-w-2xl">
            {rows.length} badges to earn as you study — streaks for daily consistency, JLPT level
            milestones from N5 to N1, skill badges for kana, kanji, and grammar, and a few special
            ones along the way. Sign up and start a lesson to begin earning them.
          </p>
          <Link href="/start-here" className="btn-primary inline-block mt-5">
            Start Learning →
          </Link>
        </header>

        {orderedCategories.map((category) => {
          const badges = byCategory.get(category) ?? [];
          return (
            <section key={category} className="mb-10">
              <h2 className="font-heading text-xl font-bold text-charcoal mb-4">
                {CATEGORY_LABELS[category] || category}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {badges.map((badge) => {
                  const color = badge.color || "#D0021B";
                  return (
                    <article
                      key={badge.id}
                      className="rounded-2xl border border-[var(--divider)] bg-white p-5 shadow-sm"
                    >
                      <div className="flex items-start gap-4">
                        <span
                          className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                          style={{ backgroundColor: `${color}14`, color }}
                          aria-hidden="true"
                        >
                          {badge.emoji || "🏆"}
                        </span>
                        <div className="min-w-0">
                          <h3 className="font-heading font-bold text-charcoal text-sm mb-1">{badge.name}</h3>
                          <p className="text-secondary text-xs leading-relaxed">{badge.description}</p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
