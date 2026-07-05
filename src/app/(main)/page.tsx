import Link from "next/link";
import { sql } from "@/lib/db";
import { getAdminSession } from "@/lib/auth/admin";
import { HomeBundleCard } from "@/components/HomeBundleCard";
import { BundleComparisonTable } from "@/components/BundleComparisonTable";
import { HomeFaq } from "@/components/HomeFaq";
import { LeadMagnetForm } from "@/components/LeadMagnetForm";
import { RecentBlogSection } from "@/components/RecentBlogSection";
import { NewsletterSection } from "@/components/NewsletterSection";
import { HeroDark } from "@/components/HeroDark";
import {
  StepsSection,
  NihongoNaviSection,
  QuizCTASection,
  WhyAvnishSection,
} from "@/components/HomeSections";

const isComingSoon = process.env.COMING_SOON === "true" || process.env.COMING_SOON === "1";

const FALLBACK_PRODUCTS = [
  { id: "1", slug: "japanese-n5-mastery-bundle", name: "🔥 Japanese N5 Mastery Bundle", price_paise: 19900, compare_price_paise: 99900, jlpt_level: "N5", badge: "offer", is_mega: false, image_url: null },
  { id: "2", slug: "japanese-n4-upgrade-bundle", name: "🎌 Japanese N4 Upgrade Bundle", price_paise: 29900, compare_price_paise: 129900, jlpt_level: "N4", badge: "offer", is_mega: false, image_url: null },
  { id: "3", slug: "japanese-n3-power-bundle", name: "⚡ Japanese N3 Power Bundle", price_paise: 39900, compare_price_paise: 169900, jlpt_level: "N3", badge: "offer", is_mega: false, image_url: null },
  { id: "4", slug: "japanese-n2-pro-bundle", name: "💼 Japanese N2 Pro Bundle", price_paise: 49900, compare_price_paise: 229900, jlpt_level: "N2", badge: "offer", is_mega: false, image_url: null },
  { id: "5", slug: "japanese-n1-elite-bundle", name: "🏆 Japanese N1 Elite Bundle", price_paise: 59900, compare_price_paise: 249900, jlpt_level: "N1", badge: "premium", is_mega: false, image_url: null },
  { id: "6", slug: "complete-japanese-n5-n1-mega-bundle", name: "🎌 Japanese Complete N5–N1 Mega Bundle", price_paise: 89900, compare_price_paise: 359900, jlpt_level: null, badge: "premium", is_mega: true, image_url: null },
];

const MEGA_HIGHLIGHTS = [
  "All Kanji, Vocab & Grammar N5→N1",
  "Mock tests at every level",
  "Audio drills + Day-by-day roadmap",
  "Lifetime access via Library",
];

function ComingSoonView() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 japanese-wave-bg">
      <div className="text-center max-w-lg">
        <p className="text-primary font-medium uppercase tracking-widest text-sm mb-4">日本語</p>
        <h1 className="font-heading text-4xl sm:text-5xl font-bold text-charcoal mb-4">
          Something Great Is Coming
        </h1>
        <p className="text-secondary text-lg mb-8">
          We&apos;re building premium Japanese learning resources — JLPT bundles, placement quiz, and more. Stay tuned.
        </p>
        <p className="text-secondary text-sm">Coming soon</p>
      </div>
    </div>
  );
}

async function FullHomeView() {
  const settingsKeys = ["bundle_comparison", "study_roadmap", "homepage_feature_strip", "testimonials_about", "homepage_faq"];

  let products: typeof FALLBACK_PRODUCTS;
  const settings: Record<string, unknown> = {};
  let lessons: { id: string; slug: string; title: string; content_type: string; jlpt_level: string | null }[] = [];

  try {
    if (sql) {
      const [productRows, settingsRows, lessonRows] = await Promise.all([
        sql`SELECT * FROM products ORDER BY sort_order ASC`,
        sql`SELECT key, value FROM site_settings WHERE key = ANY(${settingsKeys})`,
        sql`SELECT id, slug, title, content_type, (jlpt_level)[1] AS jlpt_level FROM posts WHERE status = 'published' AND content_type IN ('grammar', 'vocabulary', 'kanji') ORDER BY created_at DESC LIMIT 6`,
      ]);
      products = ((productRows as Record<string, unknown>[])?.length ? (productRows as Record<string, unknown>[]) : FALLBACK_PRODUCTS) as typeof FALLBACK_PRODUCTS;
      (settingsRows as { key: string; value: unknown }[]).forEach((r) => { settings[r.key] = r.value; });
      lessons = (lessonRows as { id: string; slug: string; title: string; content_type: string; jlpt_level: string | null }[]) ?? [];
    } else {
      products = FALLBACK_PRODUCTS;
    }
  } catch {
    products = FALLBACK_PRODUCTS;
  }

  const session = await getAdminSession();
  const isAdmin = !!session;

  const mega = products.find((p: { is_mega?: boolean }) => p.is_mega);
  const restProducts = products.filter((p: { is_mega?: boolean }) => !p.is_mega);
  const TYPE_LABELS: Record<string, string> = {
    grammar: "Grammar",
    vocabulary: "Vocabulary",
    kanji: "Kanji",
  };

  const megaPrice = mega ? `₹${Math.round(mega.price_paise / 100)}` : "₹899";
  const megaCompare = mega?.compare_price_paise
    ? `₹${Math.round(mega.compare_price_paise / 100)}`
    : "₹3,599";

  return (
    <div>
      {/* Dark ink hero */}
      <HeroDark megaProduct={mega ?? null} isAdmin={isAdmin} />

      {/* How it works — 3 steps */}
      <StepsSection />

      {/* Bundle grid — admin only */}
      {isAdmin && (
        <section className="py-[80px] px-4 sm:px-6 bg-[var(--background)] border-t border-[var(--divider)]">
          <div className="max-w-[1100px] mx-auto">
            <div className="mb-10">
              <div className="text-[11px] font-bold tracking-[.1em] uppercase text-[var(--subtle)] mb-2">
                Digital bundles
              </div>
              <h2 className="font-serif text-[32px] font-normal text-[#1A1A1A] mb-3">
                Choose your path
              </h2>
              <p className="text-[16px] text-[#555] max-w-[560px]">
                Every bundle includes worksheets, mock tests, audio drills, and lifetime access via your Library.
              </p>
            </div>

            {/* Mega hero card */}
            {mega && (
              <div
                className="border-2 border-[var(--gold)] rounded-[20px] p-8 sm:p-10 mb-6 relative overflow-hidden bg-gradient-to-br from-[#1A1A1A] to-[#2a2a2a]"
              >
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 items-center">
                  <div>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-[.06em] uppercase bg-[#fffdf0] text-[#92610a]">
                        ⭐ Best Value
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-[.06em] uppercase bg-white/10 text-white/70">
                        Save 60%
                      </span>
                    </div>
                    <h3 className="font-serif text-[24px] text-white mb-1.5 leading-snug">
                      Complete N5→N1 Mega Bundle
                    </h3>
                    <p className="text-[14px] text-white/50 mb-5">
                      Everything from beginner to advanced in one pack
                    </p>
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                      {MEGA_HIGHLIGHTS.map((f) => (
                        <div key={f} className="flex items-center gap-2 text-[13px] text-white/70">
                          <span className="text-[var(--gold)]">✓</span>
                          {f}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-start lg:items-end gap-3 flex-shrink-0">
                    <div>
                      <span className="text-[32px] font-extrabold text-white">{megaPrice}</span>
                      <span className="text-[15px] text-white/30 line-through ml-2">{megaCompare}</span>
                    </div>
                    <Link
                      href={`/product/${mega.slug}`}
                      className="inline-flex items-center gap-1 bg-primary text-white font-bold rounded-lg px-5 py-2.5 text-[14px] hover:bg-primary/90 transition-colors"
                    >
                      Buy Mega Bundle →
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px bg-[var(--divider)]" />
              <span className="text-[13px] text-[#888] font-semibold whitespace-nowrap">
                Or choose by JLPT level
              </span>
              <div className="flex-1 h-px bg-[var(--divider)]" />
            </div>

            {/* Level cards — 5-col grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
              {restProducts.map((product) => (
                <HomeBundleCard
                  key={product.id}
                  slug={product.slug}
                  name={product.name}
                  price={product.price_paise}
                  comparePrice={product.compare_price_paise}
                  badge={product.badge === "premium" ? "premium" : product.badge === "offer" ? "offer" : undefined}
                  jlptLevel={product.jlpt_level}
                  isMega={false}
                  imageUrl={product.image_url}
                />
              ))}
            </div>

            {/* Quiz nudge */}
            <div className="text-center">
              <Link href="/quiz" className="text-[14px] text-[#555]">
                Not sure which level?{" "}
                <span className="text-primary font-bold">Take the 3-minute quiz →</span>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Bundle comparison — admin only */}
      {isAdmin && (
        <section className="py-[60px] px-4 sm:px-6 bg-white border-t border-[var(--divider)]">
          <div className="max-w-[1100px] mx-auto">
            <BundleComparisonTable data={settings.bundle_comparison as Parameters<typeof BundleComparisonTable>[0]["data"]} />
          </div>
        </section>
      )}

      {/* Nihongo Navi — dark section */}
      <NihongoNaviSection />

      {/* Quiz CTA */}
      <QuizCTASection />

      {/* Why Avnish */}
      <WhyAvnishSection />

      {/* Latest lessons — hide if empty */}
      {lessons.length > 0 && (
        <section className="py-[60px] px-4 sm:px-6 bg-[var(--background)] border-t border-[var(--divider)]">
          <div className="max-w-[1100px] mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-serif text-[26px] font-normal text-[#1A1A1A]">Latest lessons</h2>
              <Link href="/learn" className="text-primary font-bold text-[13px] hover:underline">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {lessons.map((item) => (
                <Link
                  key={item.id}
                  href={`/blog/${item.content_type}/${item.slug}`}
                  className="block bg-white border border-[var(--divider)] rounded-xl p-5 hover:border-primary/40 hover:shadow-card-hover transition-all group"
                >
                  <h3 className="font-bold text-[15px] text-[#1A1A1A] group-hover:text-primary transition mb-1.5">
                    {item.title}
                  </h3>
                  <span className="text-[12px] text-[#888]">
                    {TYPE_LABELS[item.content_type] || item.content_type}
                    {item.jlpt_level ? ` • ${item.jlpt_level}` : ""}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Recent blog */}
      <RecentBlogSection />

      {/* FAQ */}
      <section className="py-[60px] px-4 sm:px-6 bg-white border-t border-[var(--divider)]">
        <div className="max-w-[1100px] mx-auto">
          <HomeFaq items={settings.homepage_faq as Parameters<typeof HomeFaq>[0]["items"]} />
        </div>
      </section>

      {/* Lead magnet */}
      <section id="free-pack" className="py-[60px] px-4 sm:px-6 bg-[var(--background)] border-t border-[var(--divider)]">
        <div className="max-w-[480px] mx-auto">
          <LeadMagnetForm />
        </div>
      </section>

      {/* Newsletter */}
      <NewsletterSection source="site" />
    </div>
  );
}

export default function HomePage() {
  return isComingSoon ? <ComingSoonView /> : <FullHomeView />;
}
