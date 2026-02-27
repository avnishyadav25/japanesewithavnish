import Link from "next/link";
import { LEVEL_SLUGS } from "@/data/jlpt-levels";
import type { LearnLevel } from "@/lib/learn-filters";

const CTA_COPY: Record<string, string> = {
  all: "Want the complete JLPT system (N5 → N1)?",
  n5: "Get the full N5 materials (worksheets, vocab, grammar, mock tests).",
  n4: "Get the full N4 materials (worksheets, vocab, grammar, mock tests).",
  n3: "Get the full N3 materials (worksheets, vocab, grammar, mock tests).",
  n2: "Get the full N2 materials (worksheets, vocab, grammar, mock tests).",
  n1: "Get the full N1 materials (worksheets, vocab, grammar, mock tests).",
};

interface LearnBundleCtaProps {
  level: LearnLevel;
}

export function LearnBundleCta({ level }: LearnBundleCtaProps) {
  const isAll = level === "all";
  const productSlug = isAll ? LEVEL_SLUGS.mega : LEVEL_SLUGS[level];
  const copy = CTA_COPY[level] ?? CTA_COPY.all;
  const buttonLabel = isAll ? "View Mega Bundle" : `Get ${level.toUpperCase()} Bundle`;

  return (
    <div className="card p-6 bg-white border border-[#EEEEEE]">
      <h3 className="font-heading text-xl font-bold text-charcoal mb-2">
        {isAll ? "Want the complete JLPT system (N5 → N1)?" : `Ready for structured ${level.toUpperCase()} practice?`}
      </h3>
      <p className="text-secondary text-sm mb-4">{copy}</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href={`/product/${productSlug}`} className="btn-primary text-center">
          {buttonLabel}
        </Link>
        <Link href="/store" className="btn-secondary text-center">
          Compare all bundles →
        </Link>
      </div>
    </div>
  );
}
