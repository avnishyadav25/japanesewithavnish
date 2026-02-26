"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const THRESHOLDS = [
  { level: "N5", minScore: 0, productSlug: "n5-mastery-bundle", productName: "N5 Mastery Bundle", why: "You're just starting. The N5 bundle will give you a solid foundation." },
  { level: "N4", minScore: 3, productSlug: "n4-upgrade-bundle", productName: "N4 Upgrade Bundle", why: "You have basics. N4 will take you to elementary level." },
  { level: "N3", minScore: 5, productSlug: "n3-power-bundle", productName: "N3 Power Bundle", why: "You're intermediate. N3 bridges to upper levels." },
  { level: "N2", minScore: 7, productSlug: "n2-pro-bundle", productName: "N2 Pro Bundle", why: "You're upper intermediate. N2 prepares for advanced." },
  { level: "N1", minScore: 9, productSlug: "n1-elite-bundle", productName: "N1 Elite Bundle", why: "You're advanced. N1 is the final stretch." },
];

function ResultContent() {
  const searchParams = useSearchParams();
  const score = parseInt(searchParams.get("score") || "0", 10);
  const total = parseInt(searchParams.get("total") || "10", 10);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"gate" | "loading" | "shown" | "error">("gate");
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
        body: JSON.stringify({ email, score, total }),
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

  if (status !== "shown") {
    return (
      <div className="py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="bento-grid">
            <div className="bento-span-4 card">
              <h1 className="font-heading text-2xl font-bold text-charcoal mb-2">See Your Results</h1>
              <p className="text-secondary mb-6">
                Enter your email to see your recommended level and bundle.
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
                <button type="submit" className="btn-primary w-full" disabled={status === "loading"}>
                  {status === "loading" ? "Loading..." : "Show My Results"}
                </button>
                {status === "error" && (
                  <p className="text-primary text-sm">Something went wrong. Try again.</p>
                )}
              </form>
            </div>
            <div className="bento-span-2 card flex flex-col justify-center bg-base border-[var(--divider)]">
              <p className="text-secondary text-sm">We&apos;ll also add you to our newsletter for JLPT tips.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-12 sm:py-16 px-4 sm:px-6">
      <div className="max-w-[1200px] mx-auto">
        <div className="bento-grid">
          <div className="bento-span-4 bento-row-2 card">
            <h1 className="font-heading text-3xl font-bold text-charcoal mb-2">
              Your Level: {recommendation.level}
            </h1>
            <p className="text-secondary mb-6">
              You scored {score} out of {total}.
            </p>
            <div className="space-y-4 mb-6">
              <h2 className="font-heading text-xl font-bold text-charcoal">Recommended: {recommendation.productName}</h2>
              <p className="text-secondary">{recommendation.why}</p>
            </div>
            <Link href={`/product/${recommendation.productSlug}`} className="btn-primary inline-block">
              Get the Bundle
            </Link>
          </div>
          <div className="bento-span-2 card flex flex-col justify-center bg-base border-[var(--divider)]">
            <Link href="/store" className="text-primary font-medium hover:underline">
              Browse all bundles →
            </Link>
          </div>
        </div>
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
