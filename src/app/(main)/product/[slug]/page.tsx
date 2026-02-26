import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddToCartButton } from "./AddToCartButton";
import { ProductSchema } from "@/components/JsonLd";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("products")
    .select("*, product_assets(*)")
    .eq("slug", slug)
    .single();

  if (error || !product) notFound();

  const priceRs = product.price_paise / 100;
  const compareRs = product.compare_price_paise ? product.compare_price_paise / 100 : null;
  const included = (product.whats_included as string[]) || [];
  const faq = (product.faq as { q: string; a: string }[]) || [];

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";
  const productUrl = `${siteUrl}/product/${product.slug}`;

  return (
    <>
      <ProductSchema
        name={product.name}
        description={product.description || undefined}
        price={priceRs}
        priceCurrency="INR"
        url={productUrl}
      />
      <div className="py-12 sm:py-16 px-4 sm:px-6">
      <div className="max-w-[1200px] mx-auto">
        <nav className="text-sm text-secondary mb-8">
          <Link href="/" className="hover:text-primary">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/store" className="hover:text-primary">Store</Link>
          <span className="mx-2">/</span>
          <span className="text-charcoal">{product.name}</span>
        </nav>

        <div className="bento-grid">
          <div className="bento-span-4 bento-row-2 card">
            {product.badge === "premium" && (
              <span className="badge-premium mb-4 inline-block">Premium</span>
            )}
            {product.badge === "offer" && (
              <span className="badge-offer mb-4 inline-block">Offer</span>
            )}
            <h1 className="font-heading text-3xl font-bold text-charcoal mb-4">{product.name}</h1>
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-3xl font-bold text-primary">₹{priceRs}</span>
              {compareRs && (
                <span className="text-secondary line-through">₹{compareRs}</span>
              )}
            </div>
            <AddToCartButton productId={product.id} slug={product.slug} pricePaise={product.price_paise} />
          </div>

          <div className="bento-span-2 card">
            <h2 className="font-heading text-lg font-bold text-charcoal mb-2">Preview / Sample</h2>
            {product.preview_url ? (
              <a
                href={product.preview_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-medium hover:underline text-sm"
              >
                View sample content →
              </a>
            ) : (
              <p className="text-secondary text-sm">Sample content available after purchase. Instant access to all materials.</p>
            )}
          </div>

          {product.who_its_for && (
            <div className="bento-span-2 card">
              <h2 className="font-heading text-lg font-bold text-charcoal mb-2">Who It&apos;s For</h2>
              <p className="text-secondary text-sm">{product.who_its_for}</p>
            </div>
          )}

          {included.length > 0 && (
            <div className="bento-span-2 bento-row-2 card">
              <h2 className="font-heading text-lg font-bold text-charcoal mb-2">What&apos;s Included</h2>
              <ul className="list-disc list-inside text-secondary text-sm space-y-1">
                {included.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {product.outcome && (
            <div className="bento-span-2 card">
              <h2 className="font-heading text-lg font-bold text-charcoal mb-2">Outcome</h2>
              <p className="text-secondary text-sm">{product.outcome}</p>
            </div>
          )}

          {faq.length > 0 && (
            <div className="bento-span-4 card">
              <h2 className="font-heading text-lg font-bold text-charcoal mb-4">FAQ</h2>
              <dl className="space-y-4">
                {faq.map((item, i) => (
                  <div key={i}>
                    <dt className="font-medium text-charcoal text-sm">{item.q}</dt>
                    <dd className="text-secondary text-sm mt-1">{item.a}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {product.no_refunds_note && (
            <div className="bento-span-6">
              <p className="text-sm text-secondary border-t border-[var(--divider)] pt-4">
                {product.no_refunds_note}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
