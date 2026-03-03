import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { ProductSidebarWithCheckout } from "./ProductSidebarWithCheckout";
import { ProductSchema } from "@/components/JsonLd";
import { BundleContentsTree } from "@/components/BundleContentsTree";
import { getBundleContents } from "@/data/bundle-contents";
import { ContentAnalytics } from "@/components/ContentAnalytics";

type ProductWithAssets = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  who_its_for?: string | null;
  whats_included?: string[] | unknown;
  outcome?: string | null;
  faq?: { q: string; a: string }[] | unknown;
  no_refunds_note?: string | null;
  image_url?: string | null;
  badge?: string | null;
  jlpt_level?: string | null;
  price_paise: number;
  compare_price_paise?: number | null;
  gallery_images?: string[] | null;
  is_mega?: boolean | null;
  preview_url?: string | null;
  product_assets?: { id: string; display_name: string; storage_path: string; type: string; sort_order?: number }[];
};

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let product: ProductWithAssets | null = null;

  if (!sql) notFound();
  const productRows = await sql`SELECT * FROM products WHERE slug = ${slug} LIMIT 1` as ProductWithAssets[];
  const prod = productRows[0];
  if (!prod) notFound();
  const assetRows = await sql`SELECT id, display_name, storage_path, type, sort_order FROM product_assets WHERE product_id = ${prod.id} ORDER BY sort_order` as { id: string; display_name: string; storage_path: string; type: string; sort_order?: number }[];
  product = { ...prod, product_assets: assetRows };

  if (!product) notFound();

  const priceRs = Number(product.price_paise) / 100;
  const compareRs = product.compare_price_paise
    ? Number(product.compare_price_paise) / 100
    : null;
  const discount =
    compareRs && compareRs > priceRs
      ? Math.round(((compareRs - priceRs) / compareRs) * 100)
      : null;
  const savingRs =
    compareRs && compareRs > priceRs ? compareRs - priceRs : null;

  const included = (product.whats_included as string[]) || [];
  const faq = (product.faq as { q: string; a: string }[]) || [];
  const galleryImages = (product.gallery_images as string[]) || [];
  const bundleContents = getBundleContents(slug);

  // Parse who_its_for into bullet list if line-separated
  const whoLines = product.who_its_for
    ? String(product.who_its_for).split("\n").map((l) => l.trim()).filter(Boolean)
    : [];

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";
  const productUrl = `${siteUrl}/product/${product.slug}`;

  return (
    <>
      <ContentAnalytics content_type="product" content_id={product.id} trackDuration />
      <ProductSchema
        name={product.name}
        description={product.description || undefined}
        price={priceRs}
        priceCurrency="INR"
        url={productUrl}
      />
      <div className="bg-[#FAF8F5] py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-[1100px] mx-auto">
          {/* Breadcrumb */}
          <nav className="text-sm text-secondary mb-8 flex items-center gap-2">
            <Link href="/" className="hover:text-primary transition-colors">
              Home
            </Link>
            <span className="opacity-50">／</span>
            <Link href="/store" className="hover:text-primary transition-colors">
              Store
            </Link>
            <span className="opacity-50">／</span>
            <span className="text-charcoal truncate max-w-[200px] sm:max-w-none">
              {product.name}
            </span>
          </nav>

          <div className="grid gap-10 lg:grid-cols-[minmax(0,680px)_340px]">
            {/* ─── Left column ─────────────────────────────── */}
            <div>
              {/* Hero image */}
              {product.image_url && (
                <div className="relative aspect-video w-full rounded-bento overflow-hidden mb-4 shadow-sm">
                  <Image
                    src={product.image_url}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 60vw"
                    priority
                  />
                  {discount && (
                    <div className="absolute top-3 right-3 bg-primary text-white text-sm font-bold px-3 py-1 rounded-full shadow">
                      {discount}% OFF
                    </div>
                  )}
                </div>
              )}

              {/* Gallery strip */}
              {galleryImages.length > 0 && (
                <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
                  {galleryImages.filter(Boolean).map((url, i) => (
                    <div
                      key={i}
                      className="relative flex-shrink-0 w-24 h-16 rounded-bento overflow-hidden border border-[var(--divider)] bg-[var(--base)]"
                    >
                      <Image
                        src={url}
                        alt={`${product.name} gallery ${i + 1}`}
                        fill
                        className="object-cover hover:scale-110 transition-transform duration-300"
                        sizes="96px"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Badges + JLPT */}
              <div className="flex items-center gap-2 flex-wrap mb-4">
                {product.badge === "premium" && (
                  <span className="badge-premium">Premium</span>
                )}
                {product.badge === "offer" && (
                  <span className="badge-offer">Offer</span>
                )}
                {product.jlpt_level && (
                  <span className="text-xs px-3 py-1 rounded-full bg-[var(--base)] border border-[var(--divider)] text-secondary font-medium">
                    JLPT {product.jlpt_level}
                  </span>
                )}
                {product.is_mega && (
                  <span className="text-xs px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold border border-primary/20">
                    Mega Bundle
                  </span>
                )}
              </div>

              {/* Description card */}
              {product.description && (
                <article className="card mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="japanese-kanji-accent text-lg">概要</span>
                    <span className="text-secondary text-sm">— Overview</span>
                  </div>
                  <p className="text-secondary text-sm leading-relaxed">
                    {product.description}
                  </p>
                </article>
              )}

              {/* Sample / preview */}
              <article className="card overflow-hidden mb-6">
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
              {whoLines.length > 0 && (
                <section className="card mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="japanese-kanji-accent text-lg">対象者</span>
                    <span className="text-secondary text-sm">—</span>
                    <span className="text-secondary text-sm">Who this is for</span>
                  </div>
                  <ul className="space-y-2">
                    {whoLines.map((line: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-secondary">
                        <span className="text-primary mt-0.5 flex-shrink-0">✓</span>
                        {line}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* What's included */}
              {included.length > 0 && (
                <section className="card mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="japanese-kanji-accent text-lg">内容</span>
                    <span className="text-secondary text-sm">—</span>
                    <span className="text-secondary text-sm">What&apos;s included</span>
                  </div>
                  <ul className="space-y-2">
                    {included.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-secondary">
                        <span className="text-primary mt-0.5 flex-shrink-0">→</span>
                        {item}
                      </li>
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

              {/* Outcome */}
              {product.outcome && (
                <section className="card mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="japanese-kanji-accent text-lg">成果</span>
                    <span className="text-secondary text-sm">—</span>
                    <span className="text-secondary text-sm">What you&apos;ll achieve</span>
                  </div>
                  <p className="text-secondary text-sm leading-relaxed">
                    {product.outcome}
                  </p>
                </section>
              )}

              {/* FAQ */}
              {faq.length > 0 && (
                <section className="card mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="japanese-kanji-accent text-lg">よくある質問</span>
                    <span className="text-secondary text-sm">— FAQ</span>
                  </div>
                  <dl className="space-y-5">
                    {faq.map((item, i) => (
                      <div key={i} className="border-b border-[var(--divider)] pb-4 last:border-0 last:pb-0">
                        <dt className="font-medium text-charcoal text-sm mb-1">
                          Q. {item.q}
                        </dt>
                        <dd className="text-secondary text-sm leading-relaxed pl-4">
                          {item.a}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {product.no_refunds_note && (
                    <p className="text-xs text-secondary mt-4 pt-3 border-t border-[var(--divider)]">
                      ⚠ {product.no_refunds_note}
                    </p>
                  )}
                </section>
              )}
            </div>

            {/* ─── Right column: sticky purchase card + quick checkout drawer ─────── */}
            <ProductSidebarWithCheckout
              product={{
                id: product.id,
                name: product.name,
                slug: product.slug,
                price_paise: product.price_paise,
                badge: product.badge,
                jlpt_level: product.jlpt_level,
                description: product.description,
              }}
              priceRs={priceRs}
              compareRs={compareRs}
              discount={discount ?? null}
              savingRs={savingRs ?? null}
              included={included}
            />
          </div>
        </div>
      </div>
    </>
  );
}
