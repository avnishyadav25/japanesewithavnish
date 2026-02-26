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
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
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
      <div className="py-24 px-4 text-center">
        <p className="text-secondary mb-4">No product selected.</p>
        <Link href="/store" className="btn-primary">Browse Store</Link>
      </div>
    );
  }

  if (loading) {
    return <div className="py-24 text-center">Loading...</div>;
  }

  if (!product) {
    return (
      <div className="py-24 px-4 text-center">
        <p className="text-secondary mb-4">Product not found.</p>
        <Link href="/store" className="btn-primary">Browse Store</Link>
      </div>
    );
  }

  return (
    <div className="py-16 px-4 sm:px-6">
      <div className="max-w-[500px] mx-auto">
        <h1 className="text-2xl font-bold text-charcoal mb-2">Checkout</h1>
        <p className="text-secondary mb-6">{product.name} — ₹{product.price_paise / 100}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className="w-full px-4 py-3 border border-[var(--divider)] rounded-button"
          />
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            className="w-full px-4 py-3 border border-[var(--divider)] rounded-button"
          />
          <input
            type="tel"
            placeholder="Phone (required for Razorpay)"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            required
            className="w-full px-4 py-3 border border-[var(--divider)] rounded-button"
          />
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? "Opening..." : "Pay with Razorpay"}
          </button>
          {error && <p className="text-primary text-sm">{error}</p>}
        </form>
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
