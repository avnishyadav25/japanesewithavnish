import Link from "next/link";
import { type JLPTLevel } from "@/data/jlpt-levels";

const CTA_COPY: Record<string, string> = {
  n5: "Get structured lessons, mock tests, audio drills, and daily practice for JLPT N5.",
  n4: "Get structured lessons, mock tests, audio drills, and daily practice for JLPT N4.",
  n3: "Get structured lessons, mock tests, audio drills, and daily practice for JLPT N3.",
  n2: "Get structured lessons, mock tests, audio drills, and daily practice for JLPT N2.",
  n1: "Get structured lessons, mock tests, audio drills, and daily practice for JLPT N1.",
  mega: "Get everything from N5 to N1 with a single Premium Pass. Best value for serious learners.",
};

interface JLPTBundleCTAProps {
  level: JLPTLevel;
}

export function JLPTBundleCTA({ level }: JLPTBundleCTAProps) {
  const copy = CTA_COPY[level] || CTA_COPY.n5;
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
        <Link href="/pricing" className="btn-primary text-center">
          Explore Premium
        </Link>
        <Link href="/quiz" className="btn-secondary text-center">
          Take the quiz →
        </Link>
      </div>
    </div>
  );
}
