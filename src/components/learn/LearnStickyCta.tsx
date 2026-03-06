"use client";

import Link from "next/link";
import { LEARN_TYPE_LABELS, type LearnContentType } from "@/lib/learn-filters";

const LEVEL_TO_BUNDLE: Record<string, { slug: string; label: string }> = {
  N5: { slug: "japanese-n5-mastery-bundle", label: "Get N5 Bundle" },
  N4: { slug: "japanese-n4-upgrade-bundle", label: "Get N4 Bundle" },
  N3: { slug: "japanese-n3-power-bundle", label: "Get N3 Bundle" },
  N2: { slug: "japanese-n2-pro-bundle", label: "Get N2 Bundle" },
  N1: { slug: "japanese-n1-elite-bundle", label: "Get N1 Bundle" },
};

interface LearnStickyCtaProps {
  contentType: string;
  primaryLevel: string;
}

export function LearnStickyCta({ contentType, primaryLevel }: LearnStickyCtaProps) {
  const typeLabel = LEARN_TYPE_LABELS[contentType as LearnContentType] ?? contentType;
  const bundle =
    primaryLevel && LEVEL_TO_BUNDLE[primaryLevel]
      ? LEVEL_TO_BUNDLE[primaryLevel]
      : { slug: "complete-japanese-n5-n1-mega-bundle", label: "Get Mega Bundle" };

  return (
    <>
      <div className="hidden lg:block lg:sticky lg:top-24">
        <div className="card p-5">
          <Link
            href={`/learn/${contentType}`}
            className="text-secondary hover:text-primary text-sm font-medium block mb-4"
          >
            ← Back to {typeLabel}
          </Link>
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
    </>
  );
}
