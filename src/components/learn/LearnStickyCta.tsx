"use client";

import Link from "next/link";
import { LEARN_TYPE_LABELS, type LearnContentType } from "@/lib/learn-filters";

interface LearnStickyCtaProps {
  contentType: string;
}

export function LearnStickyCta({ contentType }: LearnStickyCtaProps) {
  const typeLabel = LEARN_TYPE_LABELS[contentType as LearnContentType] ?? contentType;

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
    </>
  );
}
