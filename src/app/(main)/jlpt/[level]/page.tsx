import Link from "next/link";
import { notFound } from "next/navigation";

const LEVELS = ["n5", "n4", "n3", "n2", "n1"] as const;
const LEVEL_NAMES: Record<string, string> = {
  n5: "N5 — Beginner",
  n4: "N4 — Elementary",
  n3: "N3 — Intermediate",
  n2: "N2 — Upper Intermediate",
  n1: "N1 — Advanced",
};
const LEVEL_SLUGS: Record<string, string> = {
  n5: "japanese-n5-mastery-bundle",
  n4: "japanese-n4-upgrade-bundle",
  n3: "japanese-n3-power-bundle",
  n2: "japanese-n2-pro-bundle",
  n1: "japanese-n1-elite-bundle",
};

export async function generateStaticParams() {
  return LEVELS.map((level) => ({ level }));
}

export default async function JLPTLevelPage({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params;
  const normalized = level.toLowerCase();

  if (!LEVELS.includes(normalized as (typeof LEVELS)[number])) {
    notFound();
  }

  return (
    <div className="py-12 sm:py-16 px-4 sm:px-6">
      <div className="max-w-[1200px] mx-auto">
        <nav className="text-sm text-secondary mb-8">
          <Link href="/" className="hover:text-primary">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/start-here" className="hover:text-primary">JLPT</Link>
          <span className="mx-2">/</span>
          <span className="text-charcoal">{LEVEL_NAMES[normalized]}</span>
        </nav>

        <div className="bento-grid">
          <div className="bento-span-4 card">
            <h1 className="font-heading text-3xl font-bold text-charcoal mb-4">
              {LEVEL_NAMES[normalized]}
            </h1>
            <p className="text-secondary mb-6">
              Master the {normalized.toUpperCase()} level with our comprehensive bundle. Includes grammar, vocabulary, kanji, and practice materials.
            </p>
            <div className="flex flex-wrap gap-3 mb-6">
              {LEVELS.map((l) => (
                <Link
                  key={l}
                  href={`/jlpt/${l}`}
                  className={`px-4 py-2 rounded-bento font-medium transition ${
                    l === normalized
                      ? "bg-primary text-white"
                      : "bg-base border border-[var(--divider)] text-secondary hover:border-primary hover:text-primary"
                  }`}
                >
                  {l.toUpperCase()}
                </Link>
              ))}
            </div>
            <Link href={`/product/${LEVEL_SLUGS[normalized]}`} className="btn-primary">
              Get the {normalized.toUpperCase()} Bundle
            </Link>
          </div>
          <div className="bento-span-2 bento-row-2 card flex flex-col justify-center bg-base border-[var(--divider)]">
            <h2 className="font-heading text-lg font-bold text-charcoal mb-4">What You&apos;ll Learn</h2>
            <ul className="list-disc list-inside text-secondary text-sm space-y-2">
              <li>Essential grammar for {normalized.toUpperCase()}</li>
              <li>Core vocabulary and kanji</li>
              <li>Reading and listening practice</li>
              <li>Sample questions and mock tests</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
