"use client";

import { useEffect } from "react";
import { CheckoutForm, type CheckoutProduct } from "./CheckoutForm";

type CheckoutDrawerProps = {
  open: boolean;
  onClose: () => void;
  product: CheckoutProduct;
};

export function CheckoutDrawer({ open, onClose, product }: CheckoutDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onEscape = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-charcoal/50 backdrop-blur-sm transition-opacity"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-base shadow-2xl flex flex-col drawer-panel"
        role="dialog"
        aria-modal
        aria-labelledby="checkout-drawer-title"
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--divider)] shrink-0">
          <h2 id="checkout-drawer-title" className="font-heading text-lg font-bold text-charcoal">
            Quick checkout
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-bento text-secondary hover:text-charcoal hover:bg-[var(--divider)] transition"
            aria-label="Close"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="p-4 pb-8 space-y-6">
            <CheckoutForm product={product} compact />
            <div className="card p-4 bg-[var(--base)] border border-[var(--divider)]">
              <h3 className="font-heading text-sm font-bold text-charcoal mb-2">What you&apos;ll get</h3>
              <ul className="text-secondary text-sm space-y-1">
                <li>Instant access link by email after payment.</li>
                <li>Lifetime access to your bundles in the Store.</li>
                <li>Download PDFs and audio anytime on any device.</li>
              </ul>
              <p className="text-secondary text-xs mt-3">Secure payment by Razorpay.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
