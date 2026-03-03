"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";

function CheckoutLoadingSkeleton() {
  return (
    <div className="bg-[#FAF8F5] py-12 sm:py-16 px-4 sm:px-6">
      <div className="max-w-[1200px] mx-auto">
        <div className="bento-grid">
          <div className="bento-span-4 card p-6">
            <div className="h-8 w-32 bg-[var(--divider)] rounded-bento mb-4 animate-pulse" />
            <div className="h-5 w-3/4 bg-[var(--divider)] rounded-bento mb-6 animate-pulse" />
            <div className="space-y-4">
              <div className="h-12 bg-[var(--divider)] rounded-bento animate-pulse" />
              <div className="h-12 bg-[var(--divider)] rounded-bento animate-pulse" />
              <div className="h-12 bg-[var(--divider)] rounded-bento animate-pulse" />
              <div className="h-12 bg-[var(--divider)] rounded-bento animate-pulse" />
              <div className="h-12 bg-[var(--divider)] rounded-bento animate-pulse" />
            </div>
          </div>
          <div className="bento-span-2 bento-row-2 card flex flex-col justify-center bg-base border-[var(--divider)] p-6">
            <h2 className="font-heading text-lg font-bold text-charcoal mb-3">What you&apos;ll get</h2>
            <ul className="text-secondary text-sm space-y-1 mb-4">
              <li>Instant access link by email after payment.</li>
              <li>Lifetime access to your bundles in the Store.</li>
              <li>Download PDFs and audio anytime on any device.</li>
            </ul>
            <p className="text-secondary text-sm">Secure payment handled by Razorpay.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const productSlug = searchParams.get("product");
  const [product, setProduct] = useState<{ id: string; name: string; slug: string; price_paise: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!productSlug) {
      setLoading(false);
      return;
    }
    fetch(`/api/products/${productSlug}`)
      .then((r) => r.json())
      .then((data) => {
        setProduct(data.product ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [productSlug]);

  if (!productSlug) {
    return (
      <div className="bg-[#FAF8F5] py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="bento-grid">
            <div className="bento-span-6 card p-12 text-center">
              <p className="text-secondary mb-4">No product selected.</p>
              <Link href="/store" className="btn-primary">
                Browse Store
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return <CheckoutLoadingSkeleton />;
  }

  if (!product) {
    return (
      <div className="bg-[#FAF8F5] py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="bento-grid">
            <div className="bento-span-6 card p-12 text-center">
              <p className="text-secondary mb-4">Product not found.</p>
              <Link href="/store" className="btn-primary">
                Browse Store
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#FAF8F5] py-12 sm:py-16 px-4 sm:px-6">
      <div className="max-w-[1200px] mx-auto">
        <div className="bento-grid">
          <div className="bento-span-4 card p-6">
            <CheckoutForm product={product} />
          </div>
          <div className="bento-span-2 bento-row-2 card flex flex-col justify-center bg-base border-[var(--divider)] p-6">
            <h2 className="font-heading text-lg font-bold text-charcoal mb-3">What you&apos;ll get</h2>
            <ul className="text-secondary text-sm space-y-1 mb-4">
              <li>Instant access link by email after payment.</li>
              <li>Lifetime access to your bundles in the Store.</li>
              <li>Download PDFs and audio anytime on any device.</li>
            </ul>
            <p className="text-secondary text-sm mb-2">
              Payment issues? Contact support via the email on the site.
            </p>
            <p className="text-secondary text-sm">Secure payment handled by Razorpay.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<CheckoutLoadingSkeleton />}>
      <CheckoutContent />
    </Suspense>
  );
}
