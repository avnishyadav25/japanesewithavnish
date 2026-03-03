"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SyncResponse = {
  ok?: boolean;
  accessUrl?: string;
  orderDetailUrl?: string;
  already?: boolean;
  synced?: boolean;
  pending?: boolean;
};

export function ThankYouContent({ orderId }: { orderId: string | undefined }) {
  const [urls, setUrls] = useState<{ accessUrl: string; orderDetailUrl: string } | null>(null);

  useEffect(() => {
    if (!orderId) return;
    fetch(`/api/orders/${encodeURIComponent(orderId)}/sync-payment`, { method: "GET" })
      .then((r) => r.json())
      .then((data: SyncResponse) => {
        if (data.accessUrl && data.orderDetailUrl) {
          setUrls({ accessUrl: data.accessUrl, orderDetailUrl: data.orderDetailUrl });
        }
      })
      .catch(() => {});
  }, [orderId]);

  return (
    <div className="bento-grid">
      <div className="bento-span-6 card p-8 sm:p-12">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-2xl">
            ✓
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal">
            Payment successful!
          </h1>
          <p className="text-secondary max-w-md">
            We&apos;ve sent your access link to your email. You can also access your library or
            bundle below.
          </p>

          {urls ? (
            <div className="w-full mt-2 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href={urls.accessUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary inline-flex justify-center"
                >
                  Access Store
                </a>
                <Link
                  href={urls.orderDetailUrl}
                  className="btn-secondary inline-flex justify-center"
                >
                  View order details
                </Link>
              </div>
              <div
                className="text-amber-800 bg-amber-50 border border-amber-200 rounded-bento px-4 py-3 text-sm text-left"
                role="alert"
              >
                <strong>Save this link somewhere safe.</strong> This page does not show the link
                again after you refresh or leave—use the link above or the one in your email to
                access your bundle later.
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 mt-2">
              <Link href="/library" className="btn-primary">
                Go to Store
              </Link>
              <Link href="/learn" className="btn-secondary">
                Continue learning
              </Link>
            </div>
          )}

          <div className="w-full mt-8 grid gap-4 sm:grid-cols-2 text-left">
            <div className="border border-[var(--divider)] rounded-bento p-4">
              <h2 className="font-heading text-sm font-semibold text-charcoal mb-2">
                Order details
              </h2>
              <p className="text-secondary text-sm">
                <span className="font-medium text-charcoal">Order ID:</span>{" "}
                {orderId || "Available in your email receipt"}
              </p>
              <p className="text-secondary text-sm mt-1">
                <span className="font-medium text-charcoal">Access:</span>{" "}
                {urls
                  ? "Use the buttons above or the link in your confirmation email."
                  : "Check your inbox for the confirmation email and magic link."}
              </p>
            </div>
            <div className="border border-[var(--divider)] rounded-bento p-4">
              <h2 className="font-heading text-sm font-semibold text-charcoal mb-2">
                Next steps
              </h2>
              <ul className="text-secondary text-sm space-y-1">
                <li>Save your access link (email or this page before refresh).</li>
                <li>Click the link to open your library or bundle.</li>
                <li>Download your PDFs and audio to start studying.</li>
              </ul>
              <p className="text-secondary text-xs mt-3">
                If you don&apos;t see the email in 5 minutes, check your spam / promotions folder
                or use the contact email on the site.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
