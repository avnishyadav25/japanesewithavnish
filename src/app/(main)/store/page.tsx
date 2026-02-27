import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProductCard } from "@/components/ProductCard";
import { StoreFilters } from "./StoreFilters";

export default async function StorePage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string }>;
}) {
  const { level } = await searchParams;
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .order("sort_order", { ascending: true });

  const items = products && products.length > 0
    ? products
    : [
        { id: "1", slug: "japanese-n5-mastery-bundle", name: "🔥 Japanese N5 Mastery Bundle", price_paise: 19900, compare_price_paise: 99900, jlpt_level: "N5", badge: "offer", is_mega: false },
        { id: "2", slug: "japanese-n4-upgrade-bundle", name: "🎌 Japanese N4 Upgrade Bundle", price_paise: 29900, compare_price_paise: 129900, jlpt_level: "N4", badge: "offer", is_mega: false },
        { id: "3", slug: "japanese-n3-power-bundle", name: "⚡ Japanese N3 Power Bundle", price_paise: 39900, compare_price_paise: 169900, jlpt_level: "N3", badge: "offer", is_mega: false },
        { id: "4", slug: "japanese-n2-pro-bundle", name: "💼 Japanese N2 Pro Bundle", price_paise: 49900, compare_price_paise: 229900, jlpt_level: "N2", badge: "offer", is_mega: false },
        { id: "5", slug: "japanese-n1-elite-bundle", name: "🏆 Japanese N1 Elite Bundle", price_paise: 59900, compare_price_paise: 249900, jlpt_level: "N1", badge: "premium", is_mega: false },
        { id: "6", slug: "complete-japanese-n5-n1-mega-bundle", name: "🎌 Japanese Complete N5–N1 Mega Bundle", price_paise: 89900, compare_price_paise: 359900, jlpt_level: null, badge: "premium", is_mega: true },
      ];

  const levelFilter = level?.toUpperCase();
  const filtered = levelFilter
    ? items.filter((p) => p.jlpt_level === levelFilter || (levelFilter === "MEGA" && p.is_mega))
    : items;

  const mega = filtered.find((p) => p.is_mega);
  const rest = filtered.filter((p) => !p.is_mega);

  return (
    <div className="min-h-screen">
      <div className="japanese-wave-bg">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="japanese-kanji-accent text-xl">教材</span>
              <span className="text-secondary">—</span>
              <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal">Store</h1>
            </div>
            <p className="text-secondary mb-4">JLPT bundles from N5 to N1. Choose your level or get the Mega Bundle.</p>
            <StoreFilters currentLevel={level} />
          </div>

        {filtered.length === 0 ? (
          <div className="card p-12 text-center max-w-md mx-auto">
            <p className="text-secondary mb-4">No bundles match this filter.</p>
            <Link href="/store" className="btn-primary">View all</Link>
          </div>
        ) : (
        <div className="bento-grid">
          {mega && (
            <div className="bento-span-4 bento-row-2">
              <ProductCard
                slug={mega.slug}
                name={mega.name}
                price={mega.price_paise}
                comparePrice={mega.compare_price_paise}
                badge={mega.badge === "premium" ? "premium" : undefined}
                jlptLevel={mega.jlpt_level}
                size="large"
                imageUrl={mega.image_url}
                index={0}
              />
            </div>
          )}
          {rest.map((product, i) => (
            <div
              key={product.id}
              className="bento-span-2"
            >
              <ProductCard
                slug={product.slug}
                name={product.name}
                price={product.price_paise}
                comparePrice={product.compare_price_paise}
                badge={product.badge === "premium" ? "premium" : product.badge === "offer" ? "offer" : undefined}
                jlptLevel={product.jlpt_level}
                size="medium"
                imageUrl={product.image_url}
                index={(mega ? 1 : 0) + i}
              />
            </div>
          ))}
        </div>
        )}
        </div>
      </div>
    </div>
  );
}
