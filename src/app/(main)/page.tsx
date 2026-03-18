import Link from "next/link";
import { sql } from "@/lib/db";
import { HomeBundleCard } from "@/components/HomeBundleCard";
import { BundleComparisonTable } from "@/components/BundleComparisonTable";
import { StudyRoadmapMegaCta } from "@/components/StudyRoadmapMegaCta";
import { WhatsInsideStrip } from "@/components/WhatsInsideStrip";
import { TestimonialsAbout } from "@/components/TestimonialsAbout";
import { HomeFaq } from "@/components/HomeFaq";
import { LeadMagnetForm } from "@/components/LeadMagnetForm";
import { RecentBlogSection } from "@/components/RecentBlogSection";
import { NewsletterSection } from "@/components/NewsletterSection";

const isComingSoon = process.env.COMING_SOON === "true" || process.env.COMING_SOON === "1";

const FALLBACK_PRODUCTS = [
  { id: "1", slug: "japanese-n5-mastery-bundle", name: "🔥 Japanese N5 Mastery Bundle", price_paise: 19900, compare_price_paise: 99900, jlpt_level: "N5", badge: "offer", is_mega: false, image_url: null },
  { id: "2", slug: "japanese-n4-upgrade-bundle", name: "🎌 Japanese N4 Upgrade Bundle", price_paise: 29900, compare_price_paise: 129900, jlpt_level: "N4", badge: "offer", is_mega: false, image_url: null },
  { id: "3", slug: "japanese-n3-power-bundle", name: "⚡ Japanese N3 Power Bundle", price_paise: 39900, compare_price_paise: 169900, jlpt_level: "N3", badge: "offer", is_mega: false, image_url: null },
  { id: "4", slug: "japanese-n2-pro-bundle", name: "💼 Japanese N2 Pro Bundle", price_paise: 49900, compare_price_paise: 229900, jlpt_level: "N2", badge: "offer", is_mega: false, image_url: null },
  { id: "5", slug: "japanese-n1-elite-bundle", name: "🏆 Japanese N1 Elite Bundle", price_paise: 59900, compare_price_paise: 249900, jlpt_level: "N1", badge: "premium", is_mega: false, image_url: null },
  { id: "6", slug: "complete-japanese-n5-n1-mega-bundle", name: "🎌 Japanese Complete N5–N1 Mega Bundle", price_paise: 89900, compare_price_paise: 359900, jlpt_level: null, badge: "premium", is_mega: true, image_url: null },
];

const JLPT_LEVELS = [
  { level: "n5", label: "Beginner", href: "/jlpt?level=n5" },
  { level: "n4", label: "Elementary", href: "/jlpt?level=n4" },
  { level: "n3", label: "Intermediate", href: "/jlpt?level=n3" },
  { level: "n2", label: "Professional", href: "/jlpt?level=n2" },
  { level: "n1", label: "Elite", href: "/jlpt?level=n1" },
  { level: "mega", label: "Save 60% vs buying separately", href: "/product/complete-japanese-n5-n1-mega-bundle" },
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

  const mega = products.find((p: { is_mega?: boolean }) => p.is_mega);
  const restProducts = products.filter((p: { is_mega?: boolean }) => !p.is_mega);
  const TYPE_LABELS: Record<string, string> = {
    grammar: "Grammar",
    vocabulary: "Vocabulary",
    kanji: "Kanji",
  };

  return (
    <div>
      {/* Hero — full-width row 1, 3-step cards row 2. Pattern limited to hero. */}
      <section className="py-10 px-4 sm:py-16 sm:px-5 lg:px-6 hero-pattern-bg">
        <div className="max-w-[1100px] mx-auto">
          <div className="bento-grid">
            {/* Row 1: Hero full width — radius 14px, H1 40px desktop / 28-32px mobile */}
            <div className="bento-span-6 flex flex-col justify-between bg-primary text-white border-0 min-h-[200px] sm:min-h-[240px] rounded-[14px] p-6 sm:p-9 shadow-card transition-all">
              <div>
                <h1 className="font-heading text-[28px] sm:text-[40px] font-bold mb-4 leading-[1.15]">
                  Learn Japanese the Right Way
                </h1>
                <p className="text-white/90 text-base max-w-xl">
                  Premium JLPT resources from N5 to N1. Structured bundles, placement quiz, AI tutor (Nihongo Navi), and lessons.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 mt-6">
                <Link href="/quiz" className="bg-white text-primary px-5 py-3 rounded-md font-semibold hover:bg-white/90 transition h-11 flex items-center hover:-translate-y-0.5 hover:shadow-lg">
                  Take the Quiz
                </Link>
                <Link href="/store" className="border-2 border-white/80 text-white px-5 py-3 rounded-md font-semibold hover:bg-white/10 transition h-11 flex items-center">
                  Browse Bundles
                </Link>
                <Link href="/tutor" className="border-2 border-white/60 text-white px-5 py-3 rounded-md font-semibold hover:bg-white/10 transition h-11 flex items-center">
                  Nihongo Navi
                </Link>
              </div>
              <p className="text-white/85 text-[13px] mt-4">
                Instant download • Lifetime access • Secure checkout
              </p>
            </div>

            {/* Row 2: 3-step cards — 14px radius, 24px padding, big number 40px */}
            <div className="bento-span-2 card flex flex-col justify-center items-center text-center bg-white border-[#EEEEEE] rounded-[14px] p-6">
              <span className="text-[40px] font-bold text-primary mb-2">1</span>
              <h3 className="font-heading font-bold text-charcoal mb-1 text-base">Quiz</h3>
              <p className="text-secondary text-[14px] mb-4">Know your level in 3 minutes</p>
              <Link href="/quiz" className="text-primary text-sm font-medium hover:underline">Start →</Link>
            </div>
            <div className="bento-span-2 card flex flex-col justify-center items-center text-center bg-white border-[#EEEEEE] rounded-[14px] p-6">
              <span className="text-[40px] font-bold text-primary mb-2">2</span>
              <h3 className="font-heading font-bold text-charcoal mb-1 text-base">Bundle</h3>
              <p className="text-secondary text-[14px] mb-4">Get structured PDFs + practice + mock tests</p>
              <Link href="/store" className="text-primary text-sm font-medium hover:underline">Store →</Link>
            </div>
            <div className="bento-span-2 card flex flex-col justify-center items-center text-center bg-white border-[#EEEEEE] rounded-[14px] p-6">
              <span className="text-[40px] font-bold text-primary mb-2">3</span>
              <h3 className="font-heading font-bold text-charcoal mb-1 text-base">Library</h3>
              <p className="text-secondary text-[14px] mb-4">Access anytime. Study offline.</p>
              <Link href="/login" className="text-primary text-sm font-medium hover:underline">Login →</Link>
            </div>
            <div className="bento-span-2 card flex flex-col justify-center items-center text-center bg-white border-[#EEEEEE] rounded-[14px] p-6">
              <span className="text-[40px] font-bold text-primary mb-2">4</span>
              <h3 className="font-heading font-bold text-charcoal mb-1 text-base">Nihongo Navi</h3>
              <p className="text-secondary text-[14px] mb-4">AI tutor — grammar, vocab, sentence correction.</p>
              <Link href="/tutor" className="text-primary text-sm font-medium hover:underline">Try it →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* JLPT Levels — pills: 36px height, 8px 14px padding, 999px radius */}
      <section className="py-10 px-4 sm:py-[60px] sm:px-5 lg:px-6">
        <div className="max-w-[1100px] mx-auto">
          <div className="bento-grid">
            <div className="bento-span-4 card flex flex-wrap gap-3 items-center bg-white p-5">
              <h2 className="font-heading text-2xl font-bold text-charcoal w-full">JLPT Levels</h2>
              {JLPT_LEVELS.slice(0, 5).map((l) => (
                <Link
                  key={l.level}
                  href={l.href}
                  className={`h-9 px-[14px] py-2 rounded-full font-medium text-sm transition ${
                    l.level === "n1"
                      ? "bg-[#FFFDF5] border border-[var(--gold)] text-[var(--gold)]"
                      : "bg-[#FAF8F5] border border-[#EEEEEE] text-[#555555] hover:border-primary hover:text-primary"
                  }`}
                >
                  {l.level.toUpperCase()} — {l.label}
                </Link>
              ))}
              <Link href={JLPT_LEVELS[5].href} className="btn-primary flex items-center">
                Explore Levels
              </Link>
            </div>
            <div className="bento-span-2 card flex flex-col justify-center bg-[#FFF7F7] border-l-4 border-l-primary p-5">
              <h3 className="font-heading font-bold text-charcoal mb-1 text-base">Free N5 Kana Pack</h3>
              <p className="text-secondary text-sm mb-3">Get it in 30 seconds. No spam.</p>
              <Link href="#free-pack" className="text-primary font-medium hover:underline text-sm">
                Get Free Pack →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Bundles */}
      <section className="py-10 px-4 sm:py-[60px] sm:px-5 lg:px-6">
        <div className="max-w-[1100px] mx-auto">
          <h2 className="font-heading text-2xl font-bold text-charcoal mb-8">Choose your bundle</h2>
          <div className="bento-grid">
            {mega && (
              <div className="bento-span-4 bento-row-2">
                <HomeBundleCard
                  slug={mega.slug}
                  name={mega.name}
                  price={mega.price_paise}
                  comparePrice={mega.compare_price_paise}
                  badge={mega.badge === "premium" ? "premium" : undefined}
                  jlptLevel={mega.jlpt_level}
                  isMega={true}
                  imageUrl={mega.image_url}
                />
              </div>
            )}
            {restProducts.map((product: { id: string; slug: string; name: string; price_paise: number; compare_price_paise?: number; jlpt_level?: string | null; badge?: string; image_url?: string | null }) => (
              <div key={product.id} className="bento-span-2">
                <HomeBundleCard
                  slug={product.slug}
                  name={product.name}
                  price={product.price_paise}
                  comparePrice={product.compare_price_paise}
                  badge={product.badge === "premium" ? "premium" : product.badge === "offer" ? "offer" : undefined}
                  jlptLevel={product.jlpt_level}
                  isMega={false}
                  imageUrl={product.image_url}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bundle Comparison */}
      <section className="py-10 px-4 sm:py-[60px] sm:px-5 lg:px-6">
        <div className="max-w-[1100px] mx-auto">
          <BundleComparisonTable data={settings.bundle_comparison as Parameters<typeof BundleComparisonTable>[0]["data"]} />
        </div>
      </section>

      {/* Study Roadmap + Mega CTA */}
      <section className="py-10 px-4 sm:py-[60px] sm:px-5 lg:px-6">
        <div className="max-w-[1100px] mx-auto">
          <StudyRoadmapMegaCta
            data={settings.study_roadmap as Parameters<typeof StudyRoadmapMegaCta>[0]["data"]}
            megaPrice={mega?.price_paise}
          />
        </div>
      </section>

      {/* What's Inside */}
      <section className="py-10 px-4 sm:py-[60px] sm:px-5 lg:px-6">
        <div className="max-w-[1100px] mx-auto">
          <h2 className="font-heading text-2xl font-bold text-charcoal mb-4 text-center">What&apos;s inside every bundle</h2>
          <WhatsInsideStrip items={settings.homepage_feature_strip as Parameters<typeof WhatsInsideStrip>[0]["items"]} />
        </div>
      </section>

      {/* Quiz CTA */}
      <section className="py-10 px-4 sm:py-[60px] sm:px-5 lg:px-6">
        <div className="max-w-[1100px] mx-auto">
          <div className="card text-center max-w-2xl mx-auto">
            <h2 className="font-heading text-2xl font-bold text-charcoal mb-2">Not sure your level? Take the quiz.</h2>
            <p className="text-secondary mb-2">Get recommended N5/N4/N3/N2/N1 bundle.</p>
            <p className="text-secondary text-sm mb-4">Takes 3–5 minutes</p>
            <Link href="/quiz" className="btn-primary">Start Quiz</Link>
          </div>
        </div>
      </section>

      {/* Lead Magnet */}
      <section id="free-pack" className="py-10 px-4 sm:py-[60px] sm:px-5 lg:px-6">
        <div className="max-w-[1100px] mx-auto">
          <div className="max-w-md mx-auto">
            <LeadMagnetForm />
          </div>
        </div>
      </section>

      {/* Latest Lessons — hide if empty to avoid placeholder look */}
      {lessons.length > 0 && (
      <section className="py-10 px-4 sm:py-[60px] sm:px-5 lg:px-6">
        <div className="max-w-[1100px] mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-heading text-2xl font-bold text-charcoal">Latest lessons</h2>
            <Link href="/learn" className="text-primary font-medium hover:underline text-sm">
              View all lessons
            </Link>
          </div>
          <div className="bento-grid">
            {lessons.map((item: { id: string; slug: string; title: string; content_type: string; jlpt_level?: string | null }) => (
              <Link
                key={item.id}
                href={`/blog/${item.content_type}/${item.slug}`}
                className="bento-span-2 card block hover:no-underline group"
              >
                <h3 className="font-heading font-bold text-charcoal group-hover:text-primary transition">
                  {item.title}
                </h3>
                <span className="text-xs text-secondary mt-1 block">
                  {TYPE_LABELS[item.content_type] || item.content_type}
                  {item.jlpt_level ? ` • ${item.jlpt_level}` : ""}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* Recent Blog */}
      <RecentBlogSection />

      {/* Testimonials / About */}
      <section className="py-10 px-4 sm:py-[60px] sm:px-5 lg:px-6">
        <div className="max-w-[1100px] mx-auto">
          <TestimonialsAbout data={settings.testimonials_about as Parameters<typeof TestimonialsAbout>[0]["data"]} />
        </div>
      </section>

      {/* FAQ */}
      <section className="py-10 px-4 sm:py-[60px] sm:px-5 lg:px-6">
        <div className="max-w-[1100px] mx-auto">
          <HomeFaq items={settings.homepage_faq as Parameters<typeof HomeFaq>[0]["items"]} />
        </div>
      </section>

      {/* Get JLPT tips and updates — only on home */}
      <NewsletterSection source="site" />

    </div>
  );
}

export default function HomePage() {
  return isComingSoon ? <ComingSoonView /> : <FullHomeView />;
}
