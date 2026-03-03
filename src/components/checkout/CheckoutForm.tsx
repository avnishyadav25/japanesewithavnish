"use client";

import { useState, useEffect, useRef } from "react";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

/** Razorpay returns 400 when payload contains emojis. */
function sanitizeForRazorpay(s: string): string {
  const noEmoji = s.replace(/[\uD83C-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF\uFE00-\uFE0F]/g, "").trim();
  return noEmoji || "Order";
}

export type CheckoutProduct = {
  id: string;
  name: string;
  slug: string;
  price_paise: number;
};

type CheckoutFormProps = {
  product: CheckoutProduct;
  compact?: boolean;
};

export function CheckoutForm({ product, compact = false }: CheckoutFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", couponCode: "" });
  const [couponStatus, setCouponStatus] = useState<"idle" | "valid" | "invalid" | "checking">("idle");
  const [discountInfo, setDiscountInfo] = useState<{ discount_paise: number; final_paise: number } | null>(null);
  const scriptLoaded = useRef(false);

  useEffect(() => {
    if (scriptLoaded.current) return;
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    scriptLoaded.current = true;
  }, []);

  async function handleApplyCoupon() {
    if (!form.couponCode.trim()) return;
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

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");
      const options = {
        key: data.key,
        amount: Number(data.amount),
        currency: "INR",
        name: data.name ?? "Japanese with Avnish",
        description: sanitizeForRazorpay(String(data.description ?? "Order")),
        order_id: data.razorpayOrderId,
        handler: function () {
          window.location.href = `${siteUrl}/thank-you?order=${data.orderId}`;
        },
        prefill: {
          name: sanitizeForRazorpay(form.name),
          email: form.email,
          contact: form.phone,
        },
      };

      const rz = new (window as Window & { Razorpay: new (o: typeof options) => { open: () => void } }).Razorpay(options);
      rz.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setSubmitting(false);
    }
  }

  const displayPrice = discountInfo ? discountInfo.final_paise : product.price_paise;

  return (
    <div className={compact ? "space-y-4" : ""}>
      {!compact && (
        <>
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
        </>
      )}
      {compact && (
        <p className="text-secondary text-sm mb-2">
          {product.name} — <span className="font-bold text-primary">₹{displayPrice / 100}</span>
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          {!compact && (
            <label className="block text-xs font-medium text-secondary uppercase tracking-wider mb-1.5">
              Coupon code
            </label>
          )}
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
          {couponStatus === "valid" && <p className="text-green-600 text-sm mt-1">Coupon applied!</p>}
          {couponStatus === "invalid" && <p className="text-primary text-sm mt-1">Invalid or expired coupon.</p>}
        </div>
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
        <div>
          <input
            type="tel"
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            required
            className="w-full px-4 py-3 border-2 border-[var(--divider)] rounded-bento focus:border-primary focus:outline-none transition"
          />
          <p className="text-xs text-secondary mt-1">Required for Razorpay payment.</p>
        </div>
        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? "Opening..." : "Pay with Razorpay"}
        </button>
        <p className="text-xs text-secondary mt-2">
          By paying, you agree to our Terms &amp; Refund Policy (no refunds for digital products).
        </p>
        {error && <p className="text-primary text-sm mt-2">{error}</p>}
      </form>
    </div>
  );
}
