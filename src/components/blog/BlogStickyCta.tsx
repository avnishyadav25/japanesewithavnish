"use client";

import Link from "next/link";

const LEVEL_TO_BUNDLE: Record<string, { slug: string; label: string }> = {
  N5: { slug: "japanese-n5-mastery-bundle", label: "Get N5 Bundle" },
  N4: { slug: "japanese-n4-upgrade-bundle", label: "Get N4 Bundle" },
  N3: { slug: "japanese-n3-power-bundle", label: "Get N3 Bundle" },
  N2: { slug: "japanese-n2-pro-bundle", label: "Get N2 Bundle" },
  N1: { slug: "japanese-n1-elite-bundle", label: "Get N1 Bundle" },
};

interface BlogStickyCtaProps {
  primaryLevel: string;
  tags: string[];
}

export function BlogStickyCta({ primaryLevel, tags }: BlogStickyCtaProps) {
  const isRoadmap = tags.some((t) => t.toLowerCase().includes("roadmap"));
  const bundle =
    isRoadmap || !primaryLevel
      ? { slug: "complete-japanese-n5-n1-mega-bundle", label: "Get Mega Bundle" }
      : LEVEL_TO_BUNDLE[primaryLevel] || LEVEL_TO_BUNDLE.N5;

  return (
    <>
      {/* Desktop: sticky sidebar */}
      <div className="hidden lg:block lg:sticky lg:top-24">
        <div className="card p-5">
          <h3 className="font-heading font-bold text-charcoal mb-3">
            Want the complete system?
          </h3>
          <Link
            href={`/product/${bundle.slug}`}
            className="btn-primary block text-center mb-3"
          >
            {bundle.label}
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
          href={`/product/${bundle.slug}`}
          className="btn-primary flex-1 text-center"
        >
          {bundle.label}
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
