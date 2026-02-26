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
        { id: "1", slug: "n5-mastery-bundle", name: "N5 Mastery Bundle", price_paise: 19900, compare_price_paise: null, jlpt_level: "N5", badge: null },
        { id: "2", slug: "n4-upgrade-bundle", name: "N4 Upgrade Bundle", price_paise: 29900, compare_price_paise: null, jlpt_level: "N4", badge: null },
        { id: "3", slug: "n3-power-bundle", name: "N3 Power Bundle", price_paise: 39900, compare_price_paise: null, jlpt_level: "N3", badge: null },
        { id: "4", slug: "n2-pro-bundle", name: "N2 Pro Bundle", price_paise: 49900, compare_price_paise: null, jlpt_level: "N2", badge: "offer" },
        { id: "5", slug: "n1-elite-bundle", name: "N1 Elite Bundle", price_paise: 59900, compare_price_paise: null, jlpt_level: "N1", badge: "premium" },
        { id: "6", slug: "mega-bundle", name: "Complete N5–N1 Mega Bundle", price_paise: 89900, compare_price_paise: 199600, jlpt_level: null, badge: "premium" },
      ];

  const levelFilter = level?.toUpperCase();
  const filtered = levelFilter
    ? items.filter((p) => p.jlpt_level === levelFilter || (levelFilter === "MEGA" && p.slug === "mega-bundle"))
    : items;

  const mega = filtered.find((p) => p.slug === "mega-bundle");
  const rest = filtered.filter((p) => p.slug !== "mega-bundle");

  return (
    <div className="py-12 sm:py-16 px-4 sm:px-6">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-10">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal mb-2">Store</h1>
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
              />
            </div>
          )}
          {rest.map((product, i) => (
            <div
              key={product.id}
              className={i < 2 ? "bento-span-2" : "bento-span-2"}
            >
              <ProductCard
                slug={product.slug}
                name={product.name}
                price={product.price_paise}
                comparePrice={product.compare_price_paise}
                badge={product.badge === "premium" ? "premium" : product.badge === "offer" ? "offer" : undefined}
                jlptLevel={product.jlpt_level}
                size="medium"
              />
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
