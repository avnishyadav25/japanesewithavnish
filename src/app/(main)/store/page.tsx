import { createClient } from "@/lib/supabase/server";
import { ProductCard } from "@/components/ProductCard";

export default async function StorePage() {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .order("sort_order", { ascending: true });

  return (
    <div className="py-16 px-4 sm:px-6">
      <div className="max-w-[1100px] mx-auto">
        <h1 className="text-3xl font-bold text-charcoal mb-4">Store</h1>
        <p className="text-secondary mb-12">
          JLPT bundles from N5 to N1. Choose your level or get the complete Mega Bundle.
        </p>

        {products && products.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                slug={product.slug}
                name={product.name}
                price={product.price_paise}
                comparePrice={product.compare_price_paise}
                badge={product.badge === "premium" ? "premium" : product.badge === "offer" ? "offer" : undefined}
                jlptLevel={product.jlpt_level}
              />
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <ProductCard slug="n5-mastery-bundle" name="N5 Mastery Bundle" price={19900} jlptLevel="N5" />
            <ProductCard slug="n4-upgrade-bundle" name="N4 Upgrade Bundle" price={29900} jlptLevel="N4" />
            <ProductCard slug="n3-power-bundle" name="N3 Power Bundle" price={39900} jlptLevel="N3" />
            <ProductCard slug="n2-pro-bundle" name="N2 Pro Bundle" price={49900} jlptLevel="N2" badge="offer" />
            <ProductCard slug="n1-elite-bundle" name="N1 Elite Bundle" price={59900} jlptLevel="N1" badge="premium" />
            <ProductCard slug="mega-bundle" name="Complete N5–N1 Mega Bundle" price={89900} comparePrice={199600} badge="premium" />
          </div>
        )}
      </div>
    </div>
  );
}
