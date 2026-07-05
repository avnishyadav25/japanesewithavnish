import Link from "next/link";
import { sql } from "@/lib/db";
import { ProductCard } from "@/components/ProductCard";
import { BundleComparisonTable } from "@/components/BundleComparisonTable";
import { HomeFaq } from "@/components/HomeFaq";
import { NewsletterSection } from "@/components/NewsletterSection";
import { StoreHero } from "@/components/StoreHero";

interface StoreProduct {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  price_paise: number;
  compare_price_paise?: number | null;
  jlpt_level?: string | null;
  badge?: string | null;
  is_mega?: boolean | null;
  image_url?: string | null;
}

const MEGA_HIGHLIGHTS = [
  "All Kanji, Vocab & Grammar N5→N1",
  "Mock tests at every level",
  "Audio drills + Day-by-day roadmap",
  "Lifetime access via Library",
];

export default async function StorePage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; sort?: string }>;
}) {
  const { level, sort } = await searchParams;

  let items: StoreProduct[];
  let comparisonValue: unknown = null;
  let faqValue: unknown = null;

  if (sql) {
    const [productRows, compRows, faqRows] = await Promise.all([
      sql`SELECT * FROM products ORDER BY sort_order ASC`,
      sql`SELECT value FROM site_settings WHERE key = 'bundle_comparison' LIMIT 1`,
      sql`SELECT value FROM site_settings WHERE key = 'homepage_faq' LIMIT 1`,
    ]);
    items = (productRows as StoreProduct[])?.length ? (productRows as StoreProduct[]) : [];
    comparisonValue = (compRows[0] as { value: unknown })?.value ?? null;
    faqValue = (faqRows[0] as { value: unknown })?.value ?? null;
  } else {
    items = [];
    comparisonValue = null;
    faqValue = null;
  }

  const fallbackProducts: StoreProduct[] = [
    { id: "1", slug: "japanese-n5-mastery-bundle", name: "🔥 Japanese N5 Mastery Bundle", price_paise: 19900, compare_price_paise: 99900, jlpt_level: "N5", badge: "offer", is_mega: false },
    { id: "2", slug: "japanese-n4-upgrade-bundle", name: "🎌 Japanese N4 Upgrade Bundle", price_paise: 29900, compare_price_paise: 129900, jlpt_level: "N4", badge: "offer", is_mega: false },
    { id: "3", slug: "japanese-n3-power-bundle", name: "⚡ Japanese N3 Power Bundle", price_paise: 39900, compare_price_paise: 169900, jlpt_level: "N3", badge: "offer", is_mega: false },
    { id: "4", slug: "japanese-n2-pro-bundle", name: "💼 Japanese N2 Pro Bundle", price_paise: 49900, compare_price_paise: 229900, jlpt_level: "N2", badge: "offer", is_mega: false },
    { id: "5", slug: "japanese-n1-elite-bundle", name: "🏆 Japanese N1 Elite Bundle", price_paise: 59900, compare_price_paise: 249900, jlpt_level: "N1", badge: "premium", is_mega: false },
    { id: "6", slug: "complete-japanese-n5-n1-mega-bundle", name: "🎌 Japanese Complete N5–N1 Mega Bundle", price_paise: 89900, compare_price_paise: 359900, jlpt_level: null, badge: "premium", is_mega: true },
  ];
  const itemsToUse = items?.length ? items : fallbackProducts;

  const levelFilter = level?.toUpperCase();
  let filtered = levelFilter
    ? itemsToUse.filter(
        (p) => p.jlpt_level === levelFilter || (levelFilter === "MEGA" && p.is_mega)
      )
    : itemsToUse;

  const sortKey = sort === "price" || sort === "newest" ? sort : "recommended";
  if (sortKey === "price") {
    filtered = [...filtered].sort(
      (a, b) => (a.price_paise || 0) - (b.price_paise || 0)
    );
  }

  const mega = filtered.find((p) => p.is_mega);
  const rest = filtered.filter((p) => !p.is_mega);

  const comparisonData = comparisonValue || null;
  const faqItems = (faqValue as { q: string; a: string }[]) || null;

  const megaPrice = mega ? `₹${Math.round(mega.price_paise / 100)}` : "₹899";
  const megaCompare = mega?.compare_price_paise
    ? `₹${Math.round(mega.compare_price_paise / 100)}`
    : "₹3,599";

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Dark hero with filter tabs */}
      <StoreHero currentLevel={level} />

      {/* Bundle grid — light section, seamlessly follows dark hero */}
      <section className="py-10 px-4 sm:px-6 bg-[var(--background)] border-b border-[var(--divider)]">
        <div className="max-w-[1100px] mx-auto">
          {/* Active filter label */}
          {level && (
            <div className="mb-6 flex items-center gap-2 text-[14px] text-[#555]">
              Showing:{" "}
              <strong className="text-[#1A1A1A]">{level.toUpperCase()}</strong>
              <Link href="/store" className="text-primary font-bold ml-1 hover:underline">
                Clear ×
              </Link>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="bg-white border border-[var(--divider)] rounded-xl p-12 text-center max-w-md mx-auto">
              <p className="text-[#555] mb-4">No bundles match this filter.</p>
              <Link href="/store" className="btn-primary">View all</Link>
            </div>
          ) : (
            <>
              {/* Mega featured card */}
              {mega && (
                <div
                  className="border-2 border-[var(--gold)] rounded-[18px] p-8 sm:p-9 mb-5 relative overflow-hidden bg-gradient-to-br from-[#1A1A1A] to-[#2d2d2d]"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 items-center">
                    <div>
                      <div className="flex flex-wrap gap-2 mb-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-[.06em] uppercase bg-[#fffdf0] text-[#92610a]">
                          ⭐ Best Value
                        </span>
                        <span className="text-[12px] text-white/40 font-semibold flex items-center">
                          Save 60%
                        </span>
                      </div>
                      <h2 className="font-serif text-[22px] text-white mb-1.5 leading-snug">
                        Complete N5→N1 Mega Bundle
                      </h2>
                      <p className="text-[13px] text-white/50 mb-5">
                        Everything from beginner to advanced in one pack
                      </p>
                      <div className="flex flex-wrap gap-x-5 gap-y-2">
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
                        <span className="text-[30px] font-extrabold text-white">{megaPrice}</span>
                        <span className="text-[14px] text-white/30 line-through ml-2">{megaCompare}</span>
                      </div>
                      <Link
                        href={`/product/${mega.slug}`}
                        className="inline-flex items-center gap-1 bg-primary text-white font-bold rounded-lg px-5 py-2.5 text-[14px] hover:bg-primary/90 transition-colors"
                      >
                        View Mega Bundle →
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {/* Level cards — 3-col grid */}
              {rest.length > 0 && (
                <>
                  {mega && rest.length > 0 && (
                    <div className="flex items-center gap-4 mb-5">
                      <div className="flex-1 h-px bg-[var(--divider)]" />
                      <span className="text-[13px] text-[#888] font-semibold whitespace-nowrap">
                        Or choose by level
                      </span>
                      <div className="flex-1 h-px bg-[var(--divider)]" />
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {rest.map((product, i) => (
                      <ProductCard
                        key={product.id}
                        slug={product.slug}
                        name={product.name}
                        description={product.description}
                        price={product.price_paise}
                        comparePrice={product.compare_price_paise || undefined}
                        badge={
                          product.badge === "premium"
                            ? "premium"
                            : product.badge === "offer"
                            ? "offer"
                            : undefined
                        }
                        jlptLevel={product.jlpt_level || undefined}
                        size="medium"
                        imageUrl={product.image_url}
                        index={i}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* Quiz nudge */}
          <div className="text-center mt-8">
            <Link href="/quiz" className="text-[14px] text-[#555]">
              Not sure which level?{" "}
              <span className="text-primary font-bold">Take the 3-minute quiz →</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Bundle comparison */}
      <section id="comparison" className="py-[60px] px-4 sm:px-6 bg-white border-t border-[var(--divider)]">
        <div className="max-w-[1100px] mx-auto">
          <BundleComparisonTable data={comparisonData} />
        </div>
      </section>

      {/* FAQ */}
      <section className="py-[60px] px-4 sm:px-6 bg-[var(--background)] border-t border-[var(--divider)]">
        <div className="max-w-[1100px] mx-auto">
          <HomeFaq items={faqItems ? faqItems.slice(0, 3) : null} />
        </div>
      </section>

      <NewsletterSection source="store" />
    </div>
  );
}
