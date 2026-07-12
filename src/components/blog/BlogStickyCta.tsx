"use client";

import Link from "next/link";

export function BlogStickyCta() {
  return (
    <>
      {/* Desktop: sticky sidebar */}
      <div className="hidden lg:block lg:sticky lg:top-24">
        <div className="card p-5">
          <h3 className="font-heading font-bold text-charcoal mb-3">
            Want unlimited access?
          </h3>
          <p className="text-secondary text-xs mb-4 leading-relaxed">
            Get premium pass to unlock all lessons, practice tests, writing canvas, and streaks.
          </p>
          <Link
            href="/pricing"
            className="btn-primary block text-center mb-3"
          >
            Upgrade to Premium
          </Link>
          <Link
            href="/quiz"
            className="text-primary text-sm font-medium hover:underline block text-center"
          >
            Take placement quiz →
          </Link>
        </div>
      </div>
      {/* Mobile: bottom sticky bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[var(--divider)] p-4 flex items-center gap-4">
        <Link
          href="/pricing"
          className="btn-primary flex-1 text-center"
        >
          Upgrade to Premium
        </Link>
        <Link
          href="/quiz"
          className="text-primary text-sm font-medium hover:underline whitespace-nowrap"
        >
          Quiz
        </Link>
      </div>
      {/* Spacer for mobile so content isn't hidden behind sticky bar */}
      <div className="lg:hidden h-16" aria-hidden="true" />
    </>
  );
}
