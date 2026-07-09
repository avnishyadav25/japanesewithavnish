"use client";

import { useState, useEffect, useRef } from "react";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (event: string, cb: (response: unknown) => void) => void };
  }
}

type RazorpaySuccessResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

const RAZORPAY_CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
const RAZORPAY_FAILURE_GUIDANCE =
  "Try UPI or a supported domestic test card. International cards may be unavailable for this Razorpay account.";

/** Razorpay returns 400 when payload contains emojis. */
function sanitizeForRazorpay(s: string): string {
  const noEmoji = s.replace(/[\uD83C-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF\uFE00-\uFE0F]/g, "").trim();
  return noEmoji || "Order";
}

function normalizeIndianContact(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) return trimmed;

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return trimmed;
}

function loadRazorpayCheckout(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${RAZORPAY_CHECKOUT_SRC}"]`);
  if (existing) {
    return new Promise((resolve) => {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
    });
  }

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = RAZORPAY_CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
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
  isPlan?: boolean;
  currency?: "INR" | "USD";
};

export function CheckoutForm({ product, compact = false, isPlan = false, currency = "INR" }: CheckoutFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", couponCode: "" });
  const [couponStatus, setCouponStatus] = useState<"idle" | "valid" | "invalid" | "checking">("idle");
  const [discountInfo, setDiscountInfo] = useState<{ discount_paise: number; final_paise: number } | null>(null);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const scriptPromise = useRef<Promise<boolean> | null>(null);
  const prefilledFromProfile = useRef(false);

  useEffect(() => {
    if (currency === "USD") return; // Stripe handles its own checkout hosted UI script
    if (!scriptPromise.current) {
      scriptPromise.current = loadRazorpayCheckout();
    }
  }, [currency]);

  useEffect(() => {
    if (prefilledFromProfile.current) return;
    prefilledFromProfile.current = true;

    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const profile = data?.profile;
        if (!profile) return;

        const fullName =
          profile.display_name ||
          [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
          "";

        setForm((current) => ({
          ...current,
          name: current.name || fullName,
          email: current.email || profile.email || "",
          phone: current.phone || profile.phone || "",
        }));
      })
      .catch(() => {
        // Logged-out checkout should stay empty.
      });
  }, []);

  async function handleApplyCoupon() {
    if (!form.couponCode.trim()) return;
    setCouponStatus("checking");
    setDiscountInfo(null);
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: form.couponCode, productId: product.id, isPlan }),
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
    if (!agreedTerms) {
      setError("Please agree to the Terms of Service, Privacy Policy, and Refund Policy.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      if (currency === "USD") {
        const res = await fetch("/api/checkout/stripe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planId: product.id,
            name: form.name,
            email: form.email,
            phone: form.phone,
            couponCode: form.couponCode.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed");
        if (data.sessionUrl) {
          window.location.href = data.sessionUrl;
          return;
        }
        throw new Error("Invalid session url returned");
      }

      const checkoutLoaded = await (scriptPromise.current || loadRazorpayCheckout());
      if (!checkoutLoaded || !window.Razorpay) {
        throw new Error("Payment checkout could not load. Please refresh and try again.");
      }

      const res = await fetch("/api/checkout/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: isPlan ? undefined : product.id,
          planId: isPlan ? product.id : undefined,
          name: form.name,
          email: form.email,
          phone: form.phone,
          couponCode: form.couponCode.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      if (data.paymentMethod === "manual" || !data.razorpayOrderId) {
        window.location.href = `/order/${data.orderId}/pay`;
        return;
      }

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");
      const options = {
        key: data.key,
        amount: Number(data.amount),
        currency: "INR",
        name: data.name ?? "Japanese with Avnish",
        description: sanitizeForRazorpay(String(data.description ?? "Order")),
        order_id: data.razorpayOrderId,
        handler: async function (response: RazorpaySuccessResponse) {
          const verifyRes = await fetch("/api/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: data.orderId,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const verifyData = await verifyRes.json();
          if (!verifyRes.ok || !verifyData.success) {
            setError(verifyData.error || "Payment verification failed. Please contact support.");
            setSubmitting(false);
            return;
          }
          window.location.href = `${siteUrl}/thank-you?order=${data.orderId}`;
        },
        modal: {
          ondismiss: function () {
            setError("Payment was cancelled. You can try again when ready.");
            setSubmitting(false);
          },
        },
        prefill: {
          name: sanitizeForRazorpay(form.name),
          email: form.email,
          contact: normalizeIndianContact(form.phone),
        },
      };

      const rz = new window.Razorpay(options);
      rz.on("payment.failed", function (response: unknown) {
        const paymentError = response as { error?: { description?: string; reason?: string } };
        const message = paymentError.error?.description || paymentError.error?.reason || "Payment failed. Please try again.";
        setError(`${message} ${RAZORPAY_FAILURE_GUIDANCE}`);
        setSubmitting(false);
      });
      rz.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
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
                <span className="line-through text-secondary">
                  {currency === "USD" ? `$${(product.price_paise / 100).toFixed(2)}` : `₹${product.price_paise / 100}`}
                </span>{" "}
                <span className="font-bold text-primary">
                  {currency === "USD" ? `$${(discountInfo.final_paise / 100).toFixed(2)}` : `₹${discountInfo.final_paise / 100}`}
                </span>
              </>
            ) : (
              <span className="font-bold text-primary">
                {currency === "USD" ? `$${(product.price_paise / 100).toFixed(2)}` : `₹${product.price_paise / 100}`}
              </span>
            )}
          </p>
        </>
      )}
      {compact && (
        <p className="text-secondary text-sm mb-2">
          {product.name} — <span className="font-bold text-primary">{currency === "USD" ? `$${(displayPrice / 100).toFixed(2)}` : `₹${displayPrice / 100}`}</span>
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
          <p className="text-xs text-secondary mt-1">Required for payment.</p>
        </div>
        <label className="flex items-start gap-2.5 cursor-pointer py-1">
          <input
            type="checkbox"
            checked={agreedTerms}
            onChange={(e) => setAgreedTerms(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-primary rounded border-[var(--divider)] shrink-0"
            required
          />
          <span className="text-[11px] text-secondary leading-relaxed">
            I agree to the{" "}
            <a href="/policies/terms" target="_blank" className="text-primary hover:underline font-semibold">Terms of Service</a>,{" "}
            <a href="/policies/privacy" target="_blank" className="text-primary hover:underline font-semibold">Privacy Policy</a>,{" "}
            and{" "}
            <a href="/policies/refunds" target="_blank" className="text-primary hover:underline font-semibold">Refund Policy</a>.
          </span>
        </label>
        <button type="submit" className="btn-primary w-full" disabled={submitting || !agreedTerms}>
          {submitting ? "Opening payment..." : "Continue to payment"}
        </button>
        <p className="text-xs text-secondary mt-2">
          Payments are secure and encrypted. Premium passes are one-time fixed-duration purchases.
        </p>
        {error && <p className="text-primary text-sm mt-2">{error}</p>}
      </form>
    </div>
  );
}
