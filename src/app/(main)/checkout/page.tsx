"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const productSlug = searchParams.get("product");
  const [product, setProduct] = useState<{ id: string; name: string; slug: string; price_paise: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", couponCode: "" });
  const [couponStatus, setCouponStatus] = useState<"idle" | "valid" | "invalid" | "checking">("idle");
  const [discountInfo, setDiscountInfo] = useState<{ discount_paise: number; final_paise: number } | null>(null);
  const scriptLoaded = useRef(false);

  useEffect(() => {
    if (!productSlug) {
      setLoading(false);
      return;
    }
    fetch(`/api/products/${productSlug}`)
      .then((r) => r.json())
      .then((data) => {
        setProduct(data.product);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [productSlug]);

  useEffect(() => {
    if (scriptLoaded.current) return;
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    scriptLoaded.current = true;
  }, []);

  async function handleApplyCoupon() {
    if (!product || !form.couponCode.trim()) return;
    setCouponStatus("checking");
    setDiscountInfo(null);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: form.couponCode, productId: product.id }),
      });
      const data = await res.json();
      if (data.valid) {
        setCouponStatus("valid");
        setDiscountInfo({ discount_paise: data.discount_paise, final_paise: data.final_paise });
      } else {
        setCouponStatus("invalid");
      }
    } catch {
      setCouponStatus("invalid");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!product) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/checkout/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          name: form.name,
          email: form.email,
          phone: form.phone,
          couponCode: form.couponCode.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      const options = {
        key: data.key,
        amount: data.amount,
        currency: "INR",
        name: data.name,
        description: data.description,
        order_id: data.razorpayOrderId,
        handler: function () {
          window.location.href = `${siteUrl}/thank-you?order=${data.orderId}`;
        },
        prefill: { name: form.name, email: form.email, contact: form.phone },
      };

      const rz = new (window as Window & { Razorpay: new (o: typeof options) => { open: () => void } }).Razorpay(options);
      rz.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!productSlug) {
    return (
      <div className="py-12 px-4">
        <div className="bento-grid">
          <div className="bento-span-6 card p-12 text-center">
            <p className="text-secondary mb-4">No product selected.</p>
            <Link href="/store" className="btn-primary">Browse Store</Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bento-grid">
        <div className="bento-span-6 card p-12 text-center">
          <p className="text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="bento-grid">
        <div className="bento-span-6 card p-12 text-center">
          <p className="text-secondary mb-4">Product not found.</p>
          <Link href="/store" className="btn-primary">Browse Store</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="py-12 sm:py-16 px-4 sm:px-6">
      <div className="max-w-[1200px] mx-auto">
        <div className="bento-grid">
          <div className="bento-span-4 card">
            <h1 className="font-heading text-2xl font-bold text-charcoal mb-2">Checkout</h1>
            <p className="text-secondary mb-6">
              {product.name} —{" "}
              {discountInfo ? (
                <>
                  <span className="line-through text-secondary">₹{product.price_paise / 100}</span>{" "}
                  <span className="font-bold text-primary">₹{discountInfo.final_paise / 100}</span>
                </>
              ) : (
                <span className="font-bold text-primary">₹{product.price_paise / 100}</span>
              )}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Coupon code"
                  value={form.couponCode}
                  onChange={(e) => {
                    setForm({ ...form, couponCode: e.target.value.toUpperCase() });
                    setCouponStatus("idle");
                  }}
                  className="flex-1 px-4 py-3 border-2 border-[var(--divider)] rounded-bento focus:border-primary focus:outline-none transition uppercase"
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  className="btn-secondary shrink-0"
                  disabled={!form.couponCode.trim() || couponStatus === "checking"}
                >
                  {couponStatus === "checking" ? "..." : "Apply"}
                </button>
              </div>
              {couponStatus === "valid" && <p className="text-green-600 text-sm">Coupon applied!</p>}
              {couponStatus === "invalid" && <p className="text-primary text-sm">Invalid or expired coupon.</p>}
              <input
                type="text"
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full px-4 py-3 border-2 border-[var(--divider)] rounded-bento focus:border-primary focus:outline-none transition"
              />
              <input
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="w-full px-4 py-3 border-2 border-[var(--divider)] rounded-bento focus:border-primary focus:outline-none transition"
              />
              <input
                type="tel"
                placeholder="Phone (required for Razorpay)"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
                className="w-full px-4 py-3 border-2 border-[var(--divider)] rounded-bento focus:border-primary focus:outline-none transition"
              />
              <button type="submit" className="btn-primary w-full" disabled={submitting}>
                {submitting ? "Opening..." : "Pay with Razorpay"}
              </button>
              {error && <p className="text-primary text-sm">{error}</p>}
            </form>
          </div>
          <div className="bento-span-2 bento-row-2 card flex flex-col justify-center bg-base border-[var(--divider)]">
            <p className="text-secondary text-sm">Secure payment via Razorpay. You&apos;ll receive instant access after payment.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center">Loading...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
