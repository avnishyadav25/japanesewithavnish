"use client";

import Link from "next/link";
import { useState } from "react";
import { getBundleHighlights } from "@/data/bundle-highlights";
import { SEVEN_DAY_PLANS } from "@/data/start-here-plans";

const TABS = [
  { id: "mega", label: "Mega (Recommended)", gold: true },
  { id: "quiz", label: "Not sure? (Quiz)", gold: false },
  { id: "n5", label: "N5", gold: false },
  { id: "n4", label: "N4", gold: false },
  { id: "n3", label: "N3", gold: false },
  { id: "n2", label: "N2", gold: false },
  { id: "n1", label: "N1", gold: true },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface Product {
  slug: string;
  name: string;
  price_paise: number;
  compare_price_paise?: number;
  jlpt_level?: string | null;
  badge?: string;
  is_mega?: boolean;
}

interface ChooseYourPathTabsProps {
  mega: Product | null;
  levelProducts: Record<string, Product>;
}

function BundleCard({
  product,
  ctaText,
  secondaryHref,
  secondaryText,
  isMega,
  goldBorder,
}: {
  product: Product;
  ctaText: string;
  secondaryHref?: string;
  secondaryText?: string;
  isMega?: boolean;
  goldBorder?: boolean;
}) {
  const priceRs = product.price_paise / 100;
  const compareRs = product.compare_price_paise ? product.compare_price_paise / 100 : null;
  const highlights = getBundleHighlights(product.slug);
  const bullets: string[] = [];
  if (highlights?.kanji_count != null) bullets.push(`${highlights.kanji_count} Kanji`);
  if (highlights?.vocab_count != null) bullets.push(`${highlights.vocab_count} Vocab`);
  if (highlights?.grammar_count != null) bullets.push(`${highlights.grammar_count} Grammar`);
  if (highlights?.mock_tests != null) bullets.push(`${highlights.mock_tests} Mock tests`);
  if (highlights?.audio) bullets.push("Audio drills");

  return (
    <div
      className={`card p-5 bg-white ${
        goldBorder ? "border-l-4 border-l-[#C8A35F]" : isMega ? "border-l-4 border-l-[#C8A35F]" : ""
      }`}
    >
      {isMega && <span className="badge-offer mb-3 inline-block">Best Value</span>}
      {product.jlpt_level && !isMega && (
        <span className="text-secondary text-xs font-medium uppercase tracking-wider block mb-2">
          {product.jlpt_level}
        </span>
      )}
      <h3 className="font-heading font-bold text-charcoal text-base mb-3">{product.name}</h3>
      {bullets.length > 0 && (
        <ul className="text-secondary text-[13px] sm:text-[14px] space-y-1 mb-4">
          {bullets.slice(0, 5).map((b, i) => (
            <li key={i}>• {b}</li>
          ))}
        </ul>
      )}
      <div className="flex items-baseline gap-2 mb-4">
        <span className="font-bold text-primary text-lg">₹{priceRs}</span>
        {compareRs && <span className="text-secondary line-through text-sm">₹{compareRs}</span>}
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href={`/product/${product.slug}`} className="btn-primary text-center">
          {ctaText}
        </Link>
        {secondaryHref && secondaryText && (
          <Link href={secondaryHref} className="btn-secondary text-center">
            {secondaryText}
          </Link>
        )}
      </div>
    </div>
  );
}

export function ChooseYourPathTabs({ mega, levelProducts }: ChooseYourPathTabsProps) {
  const [active, setActive] = useState<TabId>("mega");

  return (
    <div>
      <h2 className="font-heading text-2xl font-bold text-charcoal mb-2">Choose your path</h2>
      <p className="text-secondary mb-6">
        Start with Mega if you want the complete system. Or take the quiz to get the best level recommendation.
      </p>

      {/* Pills */}
      <div className="flex flex-wrap gap-2 mb-8">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={`h-9 px-4 py-2 rounded-full font-medium text-sm transition ${
              active === tab.id
                ? tab.gold
                  ? "bg-[#C8A35F] text-white"
                  : "bg-primary text-white"
                : "bg-[#FAF8F5] border border-[#EEEEEE] text-[#555555] hover:border-primary hover:text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="grid md:grid-cols-2 gap-8">
        {active === "mega" && (
          <>
            <div className="card p-5">
              <h3 className="font-heading font-bold text-charcoal mb-4">Mega Bundle Roadmap (N5 → N1)</h3>
              <ul className="space-y-2 text-secondary text-sm mb-4">
                <li>• Start with N5 foundation (kana + basics)</li>
                <li>• Level up to N4/N3 (reading + real-life listening)</li>
                <li>• Finish with N2/N1 (professional + advanced comprehension)</li>
                <li>• Mock tests + worksheets at every level</li>
                <li>• Study offline with lifetime access</li>
              </ul>
              <Link href="/quiz" className="text-primary text-sm font-medium hover:underline">
                Prefer a level recommendation? Take the quiz →
              </Link>
            </div>
            <div>
              {mega && (
                <BundleCard
                  product={mega}
                  ctaText="Buy Mega Bundle"
                  secondaryHref="/store"
                  secondaryText="View all bundles"
                  isMega={true}
                />
              )}
            </div>
          </>
        )}

        {active === "quiz" && (
          <>
            <div className="card p-5">
              <h3 className="font-heading font-bold text-charcoal mb-4">Take the quiz</h3>
              <ul className="space-y-2 text-secondary text-sm mb-4">
                <li>• Find your level in 3–5 minutes</li>
                <li>• Get a recommended bundle instantly</li>
                <li>• Best for complete beginners or returning learners</li>
              </ul>
            </div>
            <div className="card p-5 flex flex-col justify-center">
              <Link href="/quiz" className="btn-primary text-center mb-3">
                Start Quiz
              </Link>
              <Link href="/store" className="text-primary text-sm font-medium hover:underline text-center">
                Browse store →
              </Link>
            </div>
          </>
        )}

        {(["n5", "n4", "n3", "n2", "n1"] as const).map((level) => {
          if (active !== level) return null;
          const product = levelProducts[level];
          const plans = SEVEN_DAY_PLANS[level] || [];
          const ctaLabels: Record<string, string> = {
            n5: "Get N5 Mastery Bundle",
            n4: "Get N4 Upgrade Bundle",
            n3: "Get N3 Power Bundle",
            n2: "Get N2 Pro Bundle",
            n1: "Get N1 Elite Bundle",
          };

          return (
            <div key={level} className="contents">
              <div className="card p-5">
                <h3 className="font-heading font-bold text-charcoal mb-4">What to do next (7-day starter plan)</h3>
                <ul className="space-y-2 text-secondary text-sm">
                  {plans.map((p, i) => (
                    <li key={i}>• {p}</li>
                  ))}
                </ul>
              </div>
              <div>
                {product && (
                  <BundleCard
                    product={product}
                    ctaText={ctaLabels[level]}
                    goldBorder={level === "n1"}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
