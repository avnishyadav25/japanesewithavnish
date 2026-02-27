import Link from "next/link";
import {
  LEVEL_NAMES,
  LEVEL_SLUGS,
  LEVEL_SUMMARIES,
  LEVEL_OUTCOMES,
  LEVEL_LEARN_BULLETS,
  type JLPTLevel,
} from "@/data/jlpt-levels";

interface JLPTLevelOverviewProps {
  level: JLPTLevel;
}

export function JLPTLevelOverview({ level }: JLPTLevelOverviewProps) {
  const productSlug = LEVEL_SLUGS[level];
  const summary = LEVEL_SUMMARIES[level] || "";
  const outcomes = LEVEL_OUTCOMES[level] || [];
  const learnBullets = LEVEL_LEARN_BULLETS[level] || [];
  const levelLabel = level === "mega" ? "Mega" : level.toUpperCase();

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="card p-6">
        <h2 className="font-heading text-xl font-bold text-charcoal mb-3">
          {LEVEL_NAMES[level]}
        </h2>
        <p className="text-secondary text-sm mb-4">{summary}</p>
        <ul className="list-disc list-inside text-secondary text-sm space-y-1 mb-6">
          {outcomes.map((o, i) => (
            <li key={i}>{o}</li>
          ))}
        </ul>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link href={`/product/${productSlug}`} className="btn-primary text-center">
            Get {levelLabel} Bundle
          </Link>
          <a
            href="#lessons"
            className="text-primary text-sm font-medium hover:underline text-center sm:self-center"
          >
            Explore lessons ↓
          </a>
        </div>
      </div>
      <div className="card p-6 bg-base border-[var(--divider)]">
        <h3 className="font-heading text-lg font-bold text-charcoal mb-4">
          What you&apos;ll learn
        </h3>
        <ul className="list-disc list-inside text-secondary text-sm space-y-2">
          {learnBullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
