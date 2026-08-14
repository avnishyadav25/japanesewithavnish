import Link from "next/link";
import { getBundleHighlights } from "@/data/bundle-highlights";

interface HomeBundleCardProps {
  slug: string;
  name: string;
  price: number;
  comparePrice?: number;
  badge?: "offer" | "premium";
  jlptLevel?: string | null;
  isMega?: boolean;
  imageUrl?: string | null;
}

export function HomeBundleCard({
  slug,
  name,
  price,
  comparePrice,
  badge,
  jlptLevel,
  isMega,
}: HomeBundleCardProps) {
  const priceRs = price / 100;
  const compareRs = comparePrice ? comparePrice / 100 : null;
  const highlights = getBundleHighlights(slug);

  const bullets: string[] = [];
  if (highlights?.kanji_count != null) bullets.push(`${highlights.kanji_count} Kanji`);
  if (highlights?.vocab_count != null) bullets.push(`${highlights.vocab_count} Vocab`);
  if (highlights?.grammar_count != null) bullets.push(`${highlights.grammar_count} Grammar`);
  if (highlights?.mock_tests != null) bullets.push(`${highlights.mock_tests} Mock tests`);
  if (highlights?.audio) bullets.push("Audio drills");

  const isPremium = badge === "premium" || isMega || jlptLevel === "N1";

  return (
    <Link
      href={`/product/${slug}`}
      className={`card block hover:no-underline group overflow-hidden p-5 h-full transition-all bg-white ${
        isPremium
          ? "border-l-4 border-l-[var(--gold)]"
          : "border-l-4 border-l-primary/20 hover:border-l-primary"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        {isMega && <span className="badge-offer">Best Value</span>}
        {!isMega && badge === "offer" && <span className="badge-offer">Offer</span>}
        {!isMega && badge === "premium" && <span className="badge-premium">Premium</span>}
        {jlptLevel && !badge && !isMega && (
          <span className="text-secondary text-xs font-medium uppercase tracking-wider">{jlptLevel}</span>
        )}
        {isMega && <span className="text-xs text-[var(--gold)] font-medium">Save 60%</span>}
      </div>
      <h3 className="font-heading font-bold text-charcoal group-hover:text-primary transition-colors text-base mb-3">
        {name}
      </h3>
      {bullets.length > 0 && (
        <ul className="text-secondary text-[13px] sm:text-[14px] space-y-1 mb-4">
          {bullets.slice(0, 5).map((b, i) => (
            <li key={i}>• {b}</li>
          ))}
        </ul>
      )}
      <div className="flex items-baseline gap-2 mt-auto">
        <span className="font-bold text-primary text-lg">₹{priceRs}</span>
        {compareRs && (
          <span className="text-secondary line-through text-sm">₹{compareRs}</span>
        )}
      </div>
      <span className="inline-block mt-3 text-primary text-sm font-medium group-hover:underline">
        View Bundle →
      </span>
    </Link>
  );
}
