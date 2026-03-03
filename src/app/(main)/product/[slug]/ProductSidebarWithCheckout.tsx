"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckoutDrawer } from "@/components/checkout/CheckoutDrawer";
import type { CheckoutProduct } from "@/components/checkout/CheckoutForm";

type ProductSidebarWithCheckoutProps = {
  product: CheckoutProduct & {
    badge?: string | null;
    jlpt_level?: string | null;
    description?: string | null;
  };
  priceRs: number;
  compareRs: number | null;
  discount: number | null;
  savingRs: number | null;
  included: string[];
};

export function ProductSidebarWithCheckout({
  product,
  priceRs,
  compareRs,
  discount,
  savingRs,
  included,
}: ProductSidebarWithCheckoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <aside className="lg:sticky lg:top-24 self-start">
        <div className="card p-6 mb-4">
          <div className="flex flex-wrap gap-2 mb-3">
            {product.badge === "premium" && <span className="badge-premium">Premium</span>}
            {product.badge === "offer" && <span className="badge-offer">Offer</span>}
            {product.jlpt_level && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--base)] border border-[var(--divider)] text-secondary font-medium">
                JLPT {product.jlpt_level}
              </span>
            )}
          </div>

          <h1 className="font-heading text-xl sm:text-2xl font-bold text-charcoal mb-2">{product.name}</h1>

          {product.description && (
            <p className="text-secondary text-sm mb-4 leading-relaxed">{product.description}</p>
          )}

          <div className="bg-[var(--base)] rounded-bento p-4 mb-4">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl font-bold text-primary">₹{priceRs.toLocaleString("en-IN")}</span>
              {compareRs && (
                <span className="text-secondary line-through text-base">₹{compareRs.toLocaleString("en-IN")}</span>
              )}
            </div>
            {discount && savingRs && (
              <p className="text-green-700 text-sm font-medium">
                You save ₹{savingRs.toLocaleString("en-IN")} ({discount}% off)
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="btn-primary w-full text-center"
          >
            Buy Now — ₹{priceRs.toLocaleString("en-IN")}
          </button>

          <p className="text-xs text-secondary mt-3 text-center">
            or{" "}
            <Link href={`/checkout?product=${product.slug}`} className="text-primary font-medium hover:underline">
              checkout on full page
            </Link>
          </p>

          <ul className="mt-4 space-y-1.5 text-xs text-secondary">
            {["✓ Instant access after payment", "✓ Download all materials", "✓ Lifetime access", "✓ Secure checkout"].map(
              (t) => (
                <li key={t}>{t}</li>
              )
            )}
          </ul>

          <div className="mt-4 pt-4 border-t border-[var(--divider)] space-y-1.5">
            <Link href="/quiz" className="text-primary text-sm font-medium hover:underline block">
              Not sure your level? Take the quiz →
            </Link>
            <Link href="/store" className="text-primary text-sm font-medium hover:underline block">
              View all bundles →
            </Link>
          </div>
        </div>

        {included.length > 0 && (
          <div className="card p-4">
            <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">Includes</p>
            <ul className="space-y-1.5">
              {included.slice(0, 4).map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-secondary">
                  <span className="text-primary mt-0.5 flex-shrink-0">→</span>
                  {item}
                </li>
              ))}
              {included.length > 4 && (
                <li className="text-xs text-secondary pl-4">+ {included.length - 4} more items</li>
              )}
            </ul>
          </div>
        )}
      </aside>

      <CheckoutDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        product={{ id: product.id, name: product.name, slug: product.slug, price_paise: product.price_paise }}
      />
    </>
  );
}
