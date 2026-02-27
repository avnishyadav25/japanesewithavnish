import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProductCard } from "@/components/ProductCard";
import { StoreFilters } from "./StoreFilters";
import { BundleComparisonTable } from "@/components/BundleComparisonTable";
import { HomeFaq } from "@/components/HomeFaq";
import { NewsletterSection } from "@/components/NewsletterSection";

interface StoreProduct {
  id: string;
  slug: string;
  name: string;
  price_paise: number;
  compare_price_paise?: number | null;
  jlpt_level?: string | null;
  badge?: string | null;
  is_mega?: boolean | null;
  image_url?: string | null;
}

export default async function StorePage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; sort?: string }>;
}) {
  const { level, sort } = await searchParams;
  const supabase = await createClient();

  const [{ data: products }, { data: comparisonRow }, { data: faqRow }] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .order("sort_order", { ascending: true }),
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", "bundle_comparison")
      .maybeSingle(),
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", "homepage_faq")
      .maybeSingle(),
  ]);

  const items: StoreProduct[] =
    products && products.length > 0
      ? (products as StoreProduct[])
      : [
          {
            id: "1",
            slug: "japanese-n5-mastery-bundle",
            name: "🔥 Japanese N5 Mastery Bundle",
            price_paise: 19900,
            compare_price_paise: 99900,
            jlpt_level: "N5",
            badge: "offer",
            is_mega: false,
          },
          {
            id: "2",
            slug: "japanese-n4-upgrade-bundle",
            name: "🎌 Japanese N4 Upgrade Bundle",
            price_paise: 29900,
            compare_price_paise: 129900,
            jlpt_level: "N4",
            badge: "offer",
            is_mega: false,
          },
          {
            id: "3",
            slug: "japanese-n3-power-bundle",
            name: "⚡ Japanese N3 Power Bundle",
            price_paise: 39900,
            compare_price_paise: 169900,
            jlpt_level: "N3",
            badge: "offer",
            is_mega: false,
          },
          {
            id: "4",
            slug: "japanese-n2-pro-bundle",
            name: "💼 Japanese N2 Pro Bundle",
            price_paise: 49900,
            compare_price_paise: 229900,
            jlpt_level: "N2",
            badge: "offer",
            is_mega: false,
          },
          {
            id: "5",
            slug: "japanese-n1-elite-bundle",
            name: "🏆 Japanese N1 Elite Bundle",
            price_paise: 59900,
            compare_price_paise: 249900,
            jlpt_level: "N1",
            badge: "premium",
            is_mega: false,
          },
          {
            id: "6",
            slug: "complete-japanese-n5-n1-mega-bundle",
            name: "🎌 Japanese Complete N5–N1 Mega Bundle",
            price_paise: 89900,
            compare_price_paise: 359900,
            jlpt_level: null,
            badge: "premium",
            is_mega: true,
          },
        ];

  const levelFilter = level?.toUpperCase();
  let filtered = levelFilter
    ? items.filter(
        (p) => p.jlpt_level === levelFilter || (levelFilter === "MEGA" && p.is_mega)
      )
    : items;

  const sortKey = sort === "price" || sort === "newest" ? sort : "recommended";
  if (sortKey === "price") {
    filtered = [...filtered].sort(
      (a, b) => (a.price_paise || 0) - (b.price_paise || 0)
    );
  }

  const mega = filtered.find((p) => p.is_mega);
  const rest = filtered.filter((p) => !p.is_mega);

  const comparisonData = (comparisonRow?.value as unknown) || null;
  const faqItems = ((faqRow?.value as unknown) as { q: string; a: string }[]) || null;

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* Hero + filters (pattern background) */}
      <div className="japanese-wave-bg">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="japanese-kanji-accent text-xl">教材</span>
                <span className="text-secondary">—</span>
                <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal">
                  Store
                </h1>
              </div>
              <p className="text-secondary">
                JLPT bundles from N5 to N1. Choose your level or get the Mega Bundle.
              </p>
            </div>
            <div className="flex gap-4 text-sm">
              <Link href="/quiz" className="text-primary font-medium hover:underline">
                Take Placement Quiz →
              </Link>
              <Link
                href="/start-here"
                className="text-primary font-medium hover:underline"
              >
                Start Here →
              </Link>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 mb-4">
            <StoreFilters currentLevel={level} />
            <div className="text-right text-sm">
              <Link
                href="/store#comparison"
                className="text-primary font-medium hover:underline"
              >
                Compare bundles →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 sm:py-12">
        {filtered.length === 0 ? (
          <div className="card p-12 text-center max-w-md mx-auto">
            <p className="text-secondary mb-4">No bundles match this filter.</p>
            <Link href="/store" className="btn-primary">
              View all
            </Link>
          </div>
        ) : (
          <div className="bento-grid mb-12">
            {mega && (
              <div className="bento-span-4 bento-row-2">
                <ProductCard
                  slug={mega.slug}
                  name={mega.name}
                  price={mega.price_paise}
                  comparePrice={mega.compare_price_paise || undefined}
                  badge={
                    mega.badge === "premium"
                      ? "premium"
                      : mega.badge === "offer"
                      ? "offer"
                      : undefined
                  }
                  jlptLevel={mega.jlpt_level || undefined}
                  size="large"
                  imageUrl={mega.image_url}
                  index={0}
                />
              </div>
            )}
            {rest.map((product, i) => (
              <div key={product.id} className="bento-span-2">
                <ProductCard
                  slug={product.slug}
                  name={product.name}
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
                  index={(mega ? 1 : 0) + i}
                />
              </div>
            ))}
          </div>
        )}

        {/* Comparison table */}
        <section id="comparison" className="mb-12">
          <BundleComparisonTable data={comparisonData} />
        </section>

        {/* FAQ strip (3 items) */}
        <section className="mb-12">
          <HomeFaq items={faqItems ? faqItems.slice(0, 3) : null} />
        </section>

        {/* Newsletter */}
        <NewsletterSection source="store" />
      </div>
    </div>
  );
}

