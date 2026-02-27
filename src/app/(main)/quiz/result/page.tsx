"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const THRESHOLDS = [
  { level: "N5", minScore: 0, productSlug: "japanese-n5-mastery-bundle", productName: "Japanese N5 Mastery Bundle", why: "You're just starting. The N5 bundle will give you a solid foundation." },
  { level: "N4", minScore: 3, productSlug: "japanese-n4-upgrade-bundle", productName: "Japanese N4 Upgrade Bundle", why: "You have basics. N4 will take you to elementary level." },
  { level: "N3", minScore: 5, productSlug: "japanese-n3-power-bundle", productName: "Japanese N3 Power Bundle", why: "You're intermediate. N3 bridges to upper levels." },
  { level: "N2", minScore: 7, productSlug: "japanese-n2-pro-bundle", productName: "Japanese N2 Pro Bundle", why: "You're upper intermediate. N2 prepares for advanced." },
  { level: "N1", minScore: 9, productSlug: "japanese-n1-elite-bundle", productName: "Japanese N1 Elite Bundle", why: "You're advanced. N1 is the final stretch." },
];

function ResultContent() {
  const searchParams = useSearchParams();
  const score = parseInt(searchParams.get("score") || "0", 10);
  const total = parseInt(searchParams.get("total") || "10", 10);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"gate" | "loading" | "shown" | "error">("gate");
  const [newsletterOptIn, setNewsletterOptIn] = useState(true);
  const [recommendation, setRecommendation] = useState<typeof THRESHOLDS[0] | null>(null);

  useEffect(() => {
    const rec = [...THRESHOLDS].reverse().find((t) => score >= t.minScore) || THRESHOLDS[0];
    setRecommendation(rec);
  }, [score]);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/quiz/submit-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, score, total, newsletterOptIn }),
      });
      if (!res.ok) throw new Error("Failed");
      setStatus("shown");
    } catch {
      setStatus("error");
    }
  }

  if (!recommendation) {
    return <div className="py-24 text-center">Loading...</div>;
  }

  return (
    <div className="bg-[#FAF8F5] py-12 sm:py-16 px-4 sm:px-6">
      <div className="max-w-[1100px] mx-auto">
        {!recommendation ? null : (
          <>
            {/* Email gate */}
            {status === "gate" || status === "loading" || status === "error" ? (
              <div className="bento-grid mb-10">
                <div className="bento-span-4 card">
                  <h1 className="font-heading text-2xl sm:text-3xl font-bold text-charcoal mb-2">
                    See Your Results
                  </h1>
                  <p className="text-secondary mb-6">
                    Enter your email to unlock your recommended JLPT level and bundle.
                  </p>
                  <form onSubmit={handleEmailSubmit} className="space-y-4">
                    <input
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-4 py-3 border-2 border-[var(--divider)] rounded-bento text-charcoal focus:border-primary focus:outline-none transition"
                    />
                    <label className="flex items-center gap-2 text-sm text-secondary">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-[var(--divider)]"
                        checked={newsletterOptIn}
                        onChange={(e) => setNewsletterOptIn(e.target.checked)}
                      />
                      <span>Send me JLPT tips (1–2 emails/week). No spam.</span>
                    </label>
                    <button
                      type="submit"
                      className="btn-primary w-full"
                      disabled={status === "loading"}
                    >
                      {status === "loading" ? "Loading..." : "Show My Results"}
                    </button>
                    {status === "error" && (
                      <p className="text-primary text-sm">
                        Something went wrong. Try again.
                      </p>
                    )}
                  </form>
                </div>
                <div className="bento-span-2 card flex flex-col justify-center bg-base border-[var(--divider)]">
                  <h2 className="font-heading text-lg font-semibold text-charcoal mb-2">
                    What happens next
                  </h2>
                  <ul className="text-secondary text-sm space-y-1">
                    <li>You&apos;ll see your level instantly on this page.</li>
                    <li>We&apos;ll email your result and access link.</li>
                    <li>You can unsubscribe from emails anytime.</li>
                  </ul>
                </div>
              </div>
            ) : null}

            {/* Results card (shown after email submit) */}
            {status === "shown" && (
              <div className="bento-grid">
                <div className="bento-span-4 bento-row-2 card">
                  <h1 className="font-heading text-3xl font-bold text-charcoal mb-2">
                    Your level: {recommendation.level}
                  </h1>
                  <p className="text-secondary mb-4">
                    You scored {score} out of {total}.
                  </p>
                  <div className="inline-flex items-center gap-2 mb-4">
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#FFF7F7] text-primary border border-primary/20">
                      Confidence:{" "}
                      {score / (total || 1) >= 0.8
                        ? "High"
                        : score / (total || 1) >= 0.5
                        ? "Medium"
                        : "Exploratory"}
                    </span>
                  </div>
                  <div className="space-y-3 mb-6">
                    <h2 className="font-heading text-xl font-bold text-charcoal">
                      Recommended: {recommendation.productName}
                    </h2>
                    <ul className="text-secondary text-sm space-y-1">
                      <li>You got {score} out of {total} correct.</li>
                      <li>We looked at your answers across vocab and grammar.</li>
                      <li>This level is a good next step for your JLPT journey.</li>
                    </ul>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={`/product/${recommendation.productSlug}`}
                      className="btn-primary"
                    >
                      Get {recommendation.productName}
                    </Link>
                    <Link
                      href="/store"
                      className="text-sm text-primary font-medium hover:underline"
                    >
                      Compare all bundles →
                    </Link>
                    <Link
                      href={`/learn?level=${recommendation.level.toLowerCase()}`}
                      className="text-sm text-primary font-medium hover:underline"
                    >
                      Start learning now →
                    </Link>
                  </div>
                </div>
                <div className="bento-span-2 card flex flex-col justify-center bg-base border-[var(--divider)]">
                  <p className="text-secondary text-sm mb-2">
                    Not sure about this level?
                  </p>
                  <Link
                    href="/quiz"
                    className="text-primary font-medium hover:underline text-sm mb-2"
                  >
                    Take the quiz again →
                  </Link>
                  <Link
                    href="/start-here"
                    className="text-primary font-medium hover:underline text-sm"
                  >
                    Read the Start Here guide →
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function QuizResultPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center">Loading...</div>}>
      <ResultContent />
    </Suspense>
  );
}
