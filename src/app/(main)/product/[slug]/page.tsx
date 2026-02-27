import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddToCartButton } from "./AddToCartButton";
import { ProductSchema } from "@/components/JsonLd";
import { BundleContentsTree } from "@/components/BundleContentsTree";
import { getBundleContents } from "@/data/bundle-contents";

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
  const bundleContents = getBundleContents(slug);

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
      <div className="bg-[#FAF8F5] py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-[1100px] mx-auto">
          <nav className="text-sm text-secondary mb-8 flex items-center gap-2">
            <Link href="/" className="hover:text-primary">
              Home
            </Link>
            <span className="opacity-50">／</span>
            <Link href="/store" className="hover:text-primary">
              Store
            </Link>
            <span className="opacity-50">／</span>
            <span className="text-charcoal truncate max-w-[200px] sm:max-w-none">
              {product.name}
            </span>
          </nav>

          <div className="grid gap-10 lg:grid-cols-[minmax(0,720px)_340px]">
            {/* Left column: media + details */}
            <div>
              {/* Media / sample card */}
              <article className="card overflow-hidden mb-8">
                {product.image_url && (
                  <div className="relative aspect-video w-full mb-4 rounded-t-[10px] overflow-hidden">
                    <Image
                      src={product.image_url}
                      alt={product.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 60vw"
                      priority
                    />
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    {product.badge === "premium" && (
                      <span className="badge-premium">Premium</span>
                    )}
                    {product.badge === "offer" && (
                      <span className="badge-offer">Offer</span>
                    )}
                  </div>
                  {product.jlpt_level && (
                    <span className="text-xs px-2 py-1 rounded-md bg-[#FAF8F5] border border-[#EEEEEE] text-[#555555]">
                      {product.jlpt_level}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="japanese-kanji-accent text-sm">サンプル</span>
                  <span className="text-secondary text-xs">— Preview / Sample</span>
                </div>
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
                  <p className="text-secondary text-sm">
                    Sample content available after purchase. Instant access to all materials.
                  </p>
                )}
              </article>

              {/* Who it's for */}
              {product.who_its_for && (
                <section className="card mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="japanese-kanji-accent text-lg">対象者</span>
                    <span className="text-secondary text-sm">—</span>
                    <span className="text-secondary text-sm">Who this is for</span>
                  </div>
                  <p className="text-secondary text-sm leading-relaxed">
                    {product.who_its_for}
                  </p>
                </section>
              )}

              {/* What's included */}
              {included.length > 0 && (
                <section className="card mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="japanese-kanji-accent text-lg">内容</span>
                    <span className="text-secondary text-sm">—</span>
                    <span className="text-secondary text-sm">What&apos;s included</span>
                  </div>
                  <ul className="list-disc list-inside text-secondary text-sm space-y-1">
                    {included.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Bundle contents tree */}
              {bundleContents && (
                <section className="card mb-6">
                  <BundleContentsTree
                    items={bundleContents}
                    titleJa="含まれるファイル"
                    titleEn="Bundle contents"
                  />
                </section>
              )}

              {/* Outcomes */}
              {product.outcome && (
                <section className="card mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="japanese-kanji-accent text-lg">成果</span>
                    <span className="text-secondary text-sm">—</span>
                    <span className="text-secondary text-sm">What you&apos;ll achieve</span>
                  </div>
                  <p className="text-secondary text-sm leading-relaxed">
                    {product.outcome}
                  </p>
                </section>
              )}

              {/* Product FAQ */}
              {faq.length > 0 && (
                <section className="card mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="japanese-kanji-accent text-lg">よくある質問</span>
                    <span className="text-secondary text-sm">—</span>
                    <span className="text-secondary text-sm">FAQ</span>
                  </div>
                  <dl className="space-y-4">
                    {faq.map((item, i) => (
                      <div key={i}>
                        <dt className="font-medium text-charcoal text-sm">{item.q}</dt>
                        <dd className="text-secondary text-sm mt-1">{item.a}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}

              {/* No refunds note */}
              {product.no_refunds_note && (
                <p className="text-sm text-secondary mt-4">
                  {product.no_refunds_note}
                </p>
              )}
            </div>

            {/* Right column: sticky purchase card */}
            <aside className="lg:sticky lg:top-24">
              <div className="card p-6 mb-6">
                <h1 className="font-heading text-2xl sm:text-3xl font-bold text-charcoal mb-2">
                  {product.name}
                </h1>
                {product.who_its_for && (
                  <p className="text-secondary text-sm mb-4">
                    {product.who_its_for}
                  </p>
                )}
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-3xl font-bold text-primary">₹{priceRs}</span>
                  {compareRs && (
                    <span className="text-secondary line-through text-sm">
                      ₹{compareRs}
                    </span>
                  )}
                </div>
                <AddToCartButton
                  productId={product.id}
                  slug={product.slug}
                  pricePaise={product.price_paise}
                />
                <p className="mt-3 text-secondary text-xs">
                  Instant access • Lifetime access • Secure checkout
                </p>
                <div className="mt-4 space-y-1 text-sm">
                  <Link
                    href="/quiz"
                    className="text-primary font-medium hover:underline block"
                  >
                    Not sure your level? Take the quiz →
                  </Link>
                  <Link
                    href="/store"
                    className="text-primary font-medium hover:underline block"
                  >
                    View all bundles →
                  </Link>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
