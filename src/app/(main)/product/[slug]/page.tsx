import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddToCartButton } from "./AddToCartButton";

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

  return (
    <div className="py-16 px-4 sm:px-6">
      <div className="max-w-[1100px] mx-auto">
        <nav className="text-sm text-secondary mb-8">
          <Link href="/" className="hover:text-primary">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/store" className="hover:text-primary">Store</Link>
          <span className="mx-2">/</span>
          <span className="text-charcoal">{product.name}</span>
        </nav>

        <div className="grid lg:grid-cols-2 gap-12">
          <div>
            {product.badge === "premium" && (
              <span className="badge-premium mb-4 inline-block">Premium</span>
            )}
            {product.badge === "offer" && (
              <span className="badge-offer mb-4 inline-block">Offer</span>
            )}
            <h1 className="text-3xl font-bold text-charcoal mb-4">{product.name}</h1>
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-3xl font-bold text-primary">₹{priceRs}</span>
              {compareRs && (
                <span className="text-secondary line-through">₹{compareRs}</span>
              )}
            </div>
            <AddToCartButton productId={product.id} slug={product.slug} pricePaise={product.price_paise} />
          </div>

          <div className="space-y-8">
            {product.who_its_for && (
              <div>
                <h2 className="text-xl font-bold text-charcoal mb-2">Who It&apos;s For</h2>
                <p className="text-secondary">{product.who_its_for}</p>
              </div>
            )}

            {included.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-charcoal mb-2">What&apos;s Included</h2>
                <ul className="list-disc list-inside text-secondary space-y-1">
                  {included.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {product.outcome && (
              <div>
                <h2 className="text-xl font-bold text-charcoal mb-2">Outcome</h2>
                <p className="text-secondary">{product.outcome}</p>
              </div>
            )}

            {faq.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-charcoal mb-2">FAQ</h2>
                <dl className="space-y-4">
                  {faq.map((item, i) => (
                    <div key={i}>
                      <dt className="font-medium text-charcoal">{item.q}</dt>
                      <dd className="text-secondary mt-1">{item.a}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {product.no_refunds_note && (
              <p className="text-sm text-secondary border-t border-[var(--divider)] pt-4">
                {product.no_refunds_note}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
