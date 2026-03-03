import Link from "next/link";
import { sql } from "@/lib/db";
import { StartHereAnnouncement } from "@/components/StartHereAnnouncement";
import { ChooseYourPathTabs } from "@/components/ChooseYourPathTabs";
import { HomeBundleCard } from "@/components/HomeBundleCard";
import { StartHereCuratedBlog } from "@/components/StartHereCuratedBlog";
import { HomeFaq } from "@/components/HomeFaq";

const FALLBACK_PRODUCTS = [
  { id: "1", slug: "japanese-n5-mastery-bundle", name: "🔥 Japanese N5 Mastery Bundle", price_paise: 19900, compare_price_paise: 99900, jlpt_level: "N5", badge: "offer", is_mega: false },
  { id: "2", slug: "japanese-n4-upgrade-bundle", name: "🎌 Japanese N4 Upgrade Bundle", price_paise: 29900, compare_price_paise: 129900, jlpt_level: "N4", badge: "offer", is_mega: false },
  { id: "3", slug: "japanese-n3-power-bundle", name: "⚡ Japanese N3 Power Bundle", price_paise: 39900, compare_price_paise: 169900, jlpt_level: "N3", badge: "offer", is_mega: false },
  { id: "4", slug: "japanese-n2-pro-bundle", name: "💼 Japanese N2 Pro Bundle", price_paise: 49900, compare_price_paise: 229900, jlpt_level: "N2", badge: "offer", is_mega: false },
  { id: "5", slug: "japanese-n1-elite-bundle", name: "🏆 Japanese N1 Elite Bundle", price_paise: 59900, compare_price_paise: 249900, jlpt_level: "N1", badge: "premium", is_mega: false },
  { id: "6", slug: "complete-japanese-n5-n1-mega-bundle", name: "🎌 Japanese Complete N5–N1 Mega Bundle", price_paise: 89900, compare_price_paise: 359900, jlpt_level: null, badge: "premium", is_mega: true },
];

const LEVEL_SLUGS: Record<string, string> = {
  n5: "japanese-n5-mastery-bundle",
  n4: "japanese-n4-upgrade-bundle",
  n3: "japanese-n3-power-bundle",
  n2: "japanese-n2-pro-bundle",
  n1: "japanese-n1-elite-bundle",
};

const MEGA_SLUG = "complete-japanese-n5-n1-mega-bundle";

export default async function StartHerePage() {
  let products = FALLBACK_PRODUCTS;
  const settings: Record<string, unknown> = {};
  let allPosts: { id: string; slug: string; title: string; summary?: string | null; jlpt_level?: string[] | null }[] = [];

  if (sql) {
    const [productRows, settingsRows, postsRows] = await Promise.all([
      sql`SELECT * FROM products ORDER BY sort_order ASC`,
      sql`SELECT key, value FROM site_settings WHERE key = ANY(ARRAY['start_here_announcement', 'start_here_curated_posts', 'start_here_faq'])`,
      sql`SELECT id, slug, title, summary, jlpt_level FROM posts WHERE status = 'published'`,
    ]);
    products = (productRows as Record<string, unknown>[])?.length ? (productRows as typeof FALLBACK_PRODUCTS) : FALLBACK_PRODUCTS;
    (settingsRows as { key: string; value: unknown }[]).forEach((r) => { settings[r.key] = r.value; });
    allPosts = (postsRows as typeof allPosts) ?? [];
  }

  const mega = products.find((p: { is_mega?: boolean }) => p.is_mega) ?? products.find((p: { slug: string }) => p.slug === MEGA_SLUG) ?? null;
  const restProducts = products.filter((p: { is_mega?: boolean }) => !p.is_mega);

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

  const levelProducts: Record<string, (typeof products)[0]> = {};
  for (const [level, slug] of Object.entries(LEVEL_SLUGS)) {
    const p = products.find((x: { slug: string }) => x.slug === slug);
    if (p) levelProducts[level] = p;
  }

  const orderedBundles = mega ? [mega, ...restProducts] : restProducts;

  return (
    <div className="bg-[#FAF8F5]">
      <StartHereAnnouncement config={announcement} />

      {/* Hero */}
      <section className="py-10 px-4 sm:py-[60px] sm:px-5 lg:px-6">
        <div className="max-w-[1100px] mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal mb-4">
                Start Here
              </h1>
              <p className="text-secondary mb-6 max-w-xl">
                Whether you&apos;re starting from zero or aiming for JLPT N1, this page helps you choose the right path fast.
              </p>
              <div className="flex flex-wrap gap-3 mb-4">
                <Link href="/quiz" className="btn-primary">
                  Take the Placement Quiz
                </Link>
                <Link href={mega ? `/product/${mega.slug}` : "/store"} className="btn-secondary">
                  View Mega Bundle
                </Link>
              </div>
              <p className="text-secondary text-sm">Instant download • Lifetime access • Secure checkout</p>
            </div>
            <div className="card p-5">
              <h3 className="font-heading font-bold text-charcoal mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Link href="/quiz" className="flex items-center gap-2 text-charcoal hover:text-primary font-medium transition-colors">
                  <span>✅</span> Take Quiz (Recommended)
                </Link>
                <Link href="/store" className="flex items-center gap-2 text-charcoal hover:text-primary font-medium transition-colors">
                  <span>📦</span> Browse Bundles
                </Link>
                <Link href="/library" className="flex items-center gap-2 text-charcoal hover:text-primary font-medium transition-colors">
                  <span>📚</span> Open Store
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3-Step Cards */}
      <section className="py-10 px-4 sm:py-[60px] sm:px-5 lg:px-6">
        <div className="max-w-[1100px] mx-auto">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="card p-6">
              <span className="text-4xl font-bold text-primary mb-3 block">1</span>
              <h2 className="font-heading font-bold text-charcoal mb-2">Find Your Level</h2>
              <p className="text-secondary text-sm mb-4">
                Not sure where to start? Take the 5-minute quiz. We&apos;ll recommend the right bundle.
              </p>
              <Link href="/quiz" className="btn-primary">Take the Quiz</Link>
            </div>
            <div className="card p-6">
              <span className="text-4xl font-bold text-primary mb-3 block">2</span>
              <h2 className="font-heading font-bold text-charcoal mb-2">Choose Your Bundle</h2>
              <p className="text-secondary text-sm mb-4">
                Pick a level bundle (N5–N1) or go all-in with Mega Bundle for the full system.
              </p>
              <Link href="/store" className="btn-secondary">Browse Store</Link>
            </div>
            <div className="card p-6">
              <span className="text-4xl font-bold text-primary mb-3 block">3</span>
              <h2 className="font-heading font-bold text-charcoal mb-2">Access Your Library</h2>
              <p className="text-secondary text-sm mb-4">
                After purchase, log in anytime via email and download your material.
              </p>
              <Link href="/library" className="text-primary font-medium hover:underline">Store →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Choose Your Path */}
      <section className="py-10 px-4 sm:py-[60px] sm:px-5 lg:px-6">
        <div className="max-w-[1100px] mx-auto">
          <ChooseYourPathTabs mega={mega} levelProducts={levelProducts} />
        </div>
      </section>

      {/* Recommended Bundles */}
      <section className="py-10 px-4 sm:py-[60px] sm:px-5 lg:px-6">
        <div className="max-w-[1100px] mx-auto">
          <h2 className="font-heading text-2xl font-bold text-charcoal mb-8">Recommended bundles</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {orderedBundles.map((product: { id: string; slug: string; name: string; price_paise: number; compare_price_paise?: number; jlpt_level?: string | null; badge?: string; is_mega?: boolean }) => (
              <HomeBundleCard
                key={product.id}
                slug={product.slug}
                name={product.name}
                price={product.price_paise}
                comparePrice={product.compare_price_paise}
                badge={product.badge === "premium" ? "premium" : product.badge === "offer" ? "offer" : undefined}
                jlptLevel={product.jlpt_level}
                isMega={product.is_mega}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Curated Blog */}
      {curatedPosts.length > 0 && (
        <section className="py-10 px-4 sm:py-[60px] sm:px-5 lg:px-6">
          <div className="max-w-[1100px] mx-auto">
            <StartHereCuratedBlog posts={curatedPosts} />
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="py-10 px-4 sm:py-[60px] sm:px-5 lg:px-6">
        <div className="max-w-[1100px] mx-auto">
          <HomeFaq items={faqItems} />
        </div>
      </section>
    </div>
  );
}
