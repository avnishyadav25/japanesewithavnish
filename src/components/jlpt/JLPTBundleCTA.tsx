import Link from "next/link";
import { LEVEL_SLUGS, type JLPTLevel } from "@/data/jlpt-levels";

const CTA_COPY: Record<string, string> = {
  n5: "Get worksheets, mock tests, audio drills, and structured materials for JLPT N5.",
  n4: "Get worksheets, mock tests, audio drills, and structured materials for JLPT N4.",
  n3: "Get worksheets, mock tests, audio drills, and structured materials for JLPT N3.",
  n2: "Get worksheets, mock tests, audio drills, and structured materials for JLPT N2.",
  n1: "Get worksheets, mock tests, audio drills, and structured materials for JLPT N1.",
  mega: "Get everything from N5 to N1 in one bundle. Best value for serious learners.",
};

interface JLPTBundleCTAProps {
  level: JLPTLevel;
}

export function JLPTBundleCTA({ level }: JLPTBundleCTAProps) {
  const productSlug = LEVEL_SLUGS[level];
  const copy = CTA_COPY[level] || CTA_COPY.n5;
  const levelLabel = level === "mega" ? "Mega" : level.toUpperCase();
  const isGold = level === "n1" || level === "mega";

  return (
    <div
      className={`card p-6 ${isGold ? "border-l-4 border-l-[#C8A35F]" : ""}`}
    >
      <h3 className="font-heading text-xl font-bold text-charcoal mb-2">
        Want everything in one place?
      </h3>
      <p className="text-secondary text-sm mb-4">{copy}</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href={`/product/${productSlug}`} className="btn-primary text-center">
          Get {levelLabel} Bundle
        </Link>
        <Link href="/store" className="btn-secondary text-center">
          Compare all bundles →
        </Link>
      </div>
    </div>
  );
}
