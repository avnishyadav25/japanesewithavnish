import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { ProductSidebarWithCheckout } from "./ProductSidebarWithCheckout";
import { ProductSchema } from "@/components/JsonLd";
import { BundleContentsTree } from "@/components/BundleContentsTree";
import { getBundleContents } from "@/data/bundle-contents";
import { ContentAnalytics } from "@/components/ContentAnalytics";
import { SamplePreviewTabs } from "./SamplePreviewTabs";

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

const BUNDLE_STATS: Record<string, { value: string; label: string }[]> = {
  "japanese-n5-mastery-bundle": [
    { value: "80+", label: "Kanji" },
    { value: "800+", label: "Vocabulary" },
    { value: "100+", label: "Grammar points" },
    { value: "3", label: "Mock tests" },
  ],
  "japanese-n4-upgrade-bundle": [
    { value: "170+", label: "Kanji" },
    { value: "1,500+", label: "Vocabulary" },
    { value: "150+", label: "Grammar points" },
    { value: "3", label: "Mock tests" },
  ],
  "japanese-n3-power-bundle": [
    { value: "370+", label: "Kanji" },
    { value: "3,700+", label: "Vocabulary" },
    { value: "170+", label: "Grammar points" },
    { value: "4", label: "Mock tests" },
  ],
  "japanese-n2-pro-bundle": [
    { value: "1,000+", label: "Kanji" },
    { value: "6,000+", label: "Vocabulary" },
    { value: "200+", label: "Grammar points" },
    { value: "5", label: "Mock tests" },
  ],
  "japanese-n1-elite-bundle": [
    { value: "2,000+", label: "Kanji" },
    { value: "10,000+", label: "Vocabulary" },
    { value: "250+", label: "Grammar points" },
    { value: "5", label: "Mock tests" },
  ],
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
  const [assetRows, megaRows] = await Promise.all([
    sql`SELECT id, display_name, storage_path, type, sort_order FROM product_assets WHERE product_id = ${prod.id} ORDER BY sort_order` as unknown as Promise<{ id: string; display_name: string; storage_path: string; type: string; sort_order?: number }[]>,
    sql`SELECT slug, price_paise FROM products WHERE is_mega = true LIMIT 1` as unknown as Promise<{ slug: string; price_paise: number }[]>,
  ]);
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
  const bundleStats = BUNDLE_STATS[slug] || null;

  const whoLines = product.who_its_for
    ? String(product.who_its_for).split("\n").map((l) => l.trim()).filter(Boolean)
    : [];

  const outcomeLines = product.outcome
    ? String(product.outcome).split("\n").filter(Boolean)
    : [];

  const megaProduct = megaRows[0] || null;
  const megaSlug = megaProduct?.slug ?? null;
  const megaPrice = megaProduct
    ? `₹${Math.round(megaProduct.price_paise / 100)}`
    : "₹899";

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

      <div className="bg-[var(--background)] py-10 sm:py-14 px-4 sm:px-6">
        <div className="max-w-[1100px] mx-auto">
          {/* Breadcrumb */}
          <nav className="text-[13px] text-[#888] mb-8 flex items-center gap-1.5">
            <Link href="/" className="hover:text-primary transition-colors">Home</Link>
            <span className="opacity-40">/</span>
            <Link href="/store" className="hover:text-primary transition-colors">Store</Link>
            <span className="opacity-40">/</span>
            <span className="text-[#1A1A1A] truncate max-w-[200px] sm:max-w-none">{product.name}</span>
          </nav>

          <div className="grid gap-10 lg:grid-cols-[minmax(0,660px)_340px]">
            {/* ── Left column ── */}
            <div>
              {/* Badge row + title */}
              <div className="flex items-center gap-2 flex-wrap mb-3">
                {product.badge === "premium" && (
                  <span className="badge-premium">Premium</span>
                )}
                {product.badge === "offer" && (
                  <span className="badge-offer">Offer</span>
                )}
                {product.jlpt_level && (
                  <span className="text-[12px] px-3 py-1 rounded-full bg-[var(--background)] border border-[var(--divider)] text-[#555] font-medium">
                    JLPT {product.jlpt_level}
                  </span>
                )}
                {product.is_mega && (
                  <span className="text-[12px] px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold border border-primary/20">
                    Mega Bundle
                  </span>
                )}
              </div>

              <h1 className="font-serif text-[32px] sm:text-[38px] font-normal text-[#1A1A1A] leading-[1.15] mb-3">
                {product.name}
              </h1>

              {product.description && (
                <p className="text-[15px] text-[#555] leading-[1.75] mb-5 max-w-[540px]">
                  {product.description}
                </p>
              )}

              {/* Stats strip */}
              {bundleStats && (
                <div className="flex flex-wrap gap-2 mb-6 pt-5 border-t border-[var(--divider)]">
                  {bundleStats.map((s) => (
                    <span
                      key={s.label}
                      className="px-3 py-1.5 bg-white border border-[var(--divider)] rounded-lg text-[13px] font-medium text-[#1A1A1A]"
                    >
                      <strong>{s.value}</strong>{" "}
                      <span className="text-[#888]">{s.label}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Hero image */}
              {product.image_url && (
                <div className="relative aspect-video w-full rounded-xl overflow-hidden mb-4 border border-[var(--divider)]">
                  <Image
                    src={product.image_url}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 60vw"
                    priority
                  />
                  {discount && (
                    <div className="absolute top-3 right-3 bg-primary text-white text-[12px] font-bold px-3 py-1 rounded-full shadow">
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
                      className="relative flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden border border-[var(--divider)]"
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

              {/* What's included — 3-col grid */}
              {included.length > 0 && (
                <section className="mb-8">
                  <h2 className="font-serif text-[20px] font-normal text-[#1A1A1A] mb-4">
                    {"What's included"}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {included.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 bg-white border border-[var(--divider)] rounded-xl p-4"
                      >
                        <span className="text-primary font-bold flex-shrink-0 mt-0.5">→</span>
                        <span className="text-[13px] text-[#555] leading-relaxed">{item}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Sample preview tabs */}
              <section className="mb-2">
                <h2 className="font-serif text-[20px] font-normal text-[#1A1A1A] mb-4">
                  Sample content
                </h2>
                <SamplePreviewTabs />
              </section>

              {/* Who it's for — 2-col */}
              {whoLines.length > 0 && (
                <section className="mb-8">
                  <h2 className="font-serif text-[20px] font-normal text-[#1A1A1A] mb-4">
                    Who this is for
                  </h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <ul className="space-y-3">
                      {whoLines.map((line, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-3 p-4 bg-white rounded-xl border border-[var(--divider)]"
                        >
                          <span className="w-6 h-6 rounded-full bg-[var(--red-light)] text-primary flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5">
                            ✓
                          </span>
                          <span className="text-[13px] text-[#1A1A1A] leading-relaxed">{line}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="bg-[var(--red-light)] border border-[#fecdd3] rounded-xl p-6 flex flex-col justify-between">
                      <div>
                        <h3 className="font-serif text-[18px] font-normal text-[#1A1A1A] mb-2">
                          Not sure this is right for you?
                        </h3>
                        <p className="text-[13px] text-[#555]">
                          Take the 3-minute placement quiz — we&apos;ll recommend the right level.
                        </p>
                      </div>
                      <Link href="/quiz" className="btn-primary mt-5 self-start text-[14px]">
                        Take Quiz →
                      </Link>
                    </div>
                  </div>
                </section>
              )}

              {/* Bundle contents tree */}
              {bundleContents && (
                <section className="mb-8 bg-white border border-[var(--divider)] rounded-xl p-5">
                  <BundleContentsTree
                    items={bundleContents}
                    titleJa="含まれるファイル"
                    titleEn="Bundle contents"
                  />
                </section>
              )}

              {/* Outcomes — numbered cards */}
              {outcomeLines.length > 0 && (
                <section className="mb-8">
                  <h2 className="font-serif text-[20px] font-normal text-[#1A1A1A] mb-4">
                    {"What you'll achieve"}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {outcomeLines.map((line, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-4 bg-white border border-[var(--divider)] rounded-xl p-5"
                      >
                        <span className="font-serif text-[40px] text-[var(--divider)] leading-none font-normal flex-shrink-0">
                          {i + 1}
                        </span>
                        <p className="text-[13px] text-[#555] leading-relaxed mt-2">{line}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Mega upsell card (non-mega only) */}
              {!product.is_mega && megaSlug && (
                <div className="bg-[var(--gold-light)] border border-[var(--gold)] rounded-xl p-6 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold tracking-[.1em] uppercase text-[var(--gold-dark)] mb-1">
                      Save more
                    </p>
                    <h3 className="font-serif text-[17px] font-normal text-[#1A1A1A] mb-1">
                      Upgrade to the Complete Mega Bundle
                    </h3>
                    <p className="text-[13px] text-[#555]">
                      All 5 levels + study roadmap at {megaPrice}
                    </p>
                  </div>
                  <Link
                    href={`/product/${megaSlug}`}
                    className="btn-primary flex-shrink-0 text-[14px]"
                  >
                    View Mega Bundle →
                  </Link>
                </div>
              )}

              {/* FAQ */}
              {faq.length > 0 && (
                <section className="mb-8">
                  <h2 className="font-serif text-[20px] font-normal text-[#1A1A1A] mb-4">
                    Frequently asked questions
                  </h2>
                  <dl className="space-y-0 border border-[var(--divider)] rounded-xl overflow-hidden">
                    {faq.map((item, i) => (
                      <div
                        key={i}
                        className="px-5 py-4 border-b border-[var(--divider)] last:border-0 bg-white"
                      >
                        <dt className="font-bold text-[14px] text-[#1A1A1A] mb-1.5">
                          {item.q}
                        </dt>
                        <dd className="text-[13px] text-[#555] leading-relaxed">
                          {item.a}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {product.no_refunds_note && (
                    <p className="text-[12px] text-[#888] mt-3">
                      ⚠ {product.no_refunds_note}
                    </p>
                  )}
                </section>
              )}
            </div>

            {/* ── Right column: sticky purchase card ── */}
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
