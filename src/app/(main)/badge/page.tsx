"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Badge = {
  id: string;
  name: string;
  slug: string;
  description: string;
  category?: string;
  color?: string;
  iconEmoji?: string | null;
  isEarned: boolean;
  awardedAt?: string | null;
};

export default function BadgePage() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    fetch("/api/learn/badges")
      .then((r) => {
        if (!r.ok) throw new Error("Please log in to view your badges.");
        return r.json();
      })
      .then((data) => setBadges(data.badges ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load badges."))
      .finally(() => setLoading(false));
  }, []);

  const earned = useMemo(() => badges.filter((b) => b.isEarned), [badges]);
  const categories = useMemo(() => ["all", ...Array.from(new Set(badges.map((b) => b.category || "special")))], [badges]);
  const available = useMemo(() => {
    return badges.filter((b) => !b.isEarned && (category === "all" || (b.category || "special") === category));
  }, [badges, category]);

  function renderBadge(badge: Badge) {
    const color = badge.color || "#D0021B";
    return (
      <article
        key={badge.id}
        className={`rounded-2xl border bg-white p-5 shadow-sm ${badge.isEarned ? "border-primary/20" : "border-[var(--divider)] opacity-80"}`}
      >
        <div className="flex items-start gap-4">
          <span
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
            style={{ backgroundColor: `${color}14`, color }}
            aria-hidden="true"
          >
            {badge.iconEmoji || "🏆"}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="font-heading font-bold text-charcoal text-sm">{badge.name}</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--base)] text-secondary font-bold uppercase">
                {badge.category || "badge"}
              </span>
            </div>
            <p className="text-secondary text-xs leading-relaxed">{badge.description}</p>
            {badge.isEarned ? (
              <p className="text-primary text-[11px] font-bold mt-3">
                Earned{badge.awardedAt ? ` on ${new Date(badge.awardedAt).toLocaleDateString()}` : ""}
              </p>
            ) : (
              <p className="text-secondary text-[11px] font-semibold mt-3">Available to unlock</p>
            )}
          </div>
        </div>
      </article>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--base)] py-12 px-4">
        <div className="max-w-[900px] mx-auto rounded-bento border border-[var(--divider)] bg-white p-6">
          <p className="text-secondary text-sm">Loading badges...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--base)] py-12 px-4">
        <div className="max-w-[700px] mx-auto rounded-bento border border-[var(--divider)] bg-white p-8 text-center">
          <h1 className="font-heading text-2xl font-bold text-charcoal mb-2">Badges</h1>
          <p className="text-secondary mb-6">{error}</p>
          <Link href="/login?redirect=/badge" className="btn-primary inline-block">Log in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--base)] py-12 px-4">
      <div className="max-w-[1000px] mx-auto space-y-8">
        <header className="rounded-3xl border border-[var(--divider)] bg-white p-6 shadow-sm">
          <h1 className="font-heading text-3xl font-black text-charcoal mb-2">Badges</h1>
          <p className="text-secondary text-sm">
            Track what you have earned and what you can unlock next as you study Japanese.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <div className="rounded-2xl border border-[var(--divider)] bg-[var(--base)] p-3">
              <p className="text-[10px] text-secondary font-bold uppercase">Total</p>
              <p className="font-heading text-xl font-black text-charcoal">{badges.length}</p>
            </div>
            <div className="rounded-2xl border border-[var(--divider)] bg-[var(--base)] p-3">
              <p className="text-[10px] text-secondary font-bold uppercase">Earned</p>
              <p className="font-heading text-xl font-black text-primary">{earned.length}</p>
            </div>
            <div className="rounded-2xl border border-[var(--divider)] bg-[var(--base)] p-3">
              <p className="text-[10px] text-secondary font-bold uppercase">Available</p>
              <p className="font-heading text-xl font-black text-charcoal">{badges.length - earned.length}</p>
            </div>
            <div className="rounded-2xl border border-[var(--divider)] bg-[var(--base)] p-3">
              <p className="text-[10px] text-secondary font-bold uppercase">Progress</p>
              <p className="font-heading text-xl font-black text-charcoal">{badges.length ? Math.round((earned.length / badges.length) * 100) : 0}%</p>
            </div>
          </div>
        </header>

        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-heading font-bold text-charcoal text-lg">Earned Badges</h2>
              <p className="text-secondary text-xs">{earned.length} unlocked</p>
            </div>
            <Link href="/learn/dashboard" className="text-primary text-xs font-bold hover:underline">Back to dashboard →</Link>
          </div>
          {earned.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{earned.map(renderBadge)}</div>
          ) : (
            <div className="rounded-2xl border border-[var(--divider)] bg-white p-8 text-center">
              <p className="text-secondary text-sm">No badges earned yet. Complete your first lesson to start.</p>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h2 className="font-heading font-bold text-charcoal text-lg">Available Badges</h2>
              <p className="text-secondary text-xs">{available.length} shown · {badges.length - earned.length} still to unlock</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-full border text-[11px] font-bold capitalize ${
                    category === cat ? "bg-primary text-white border-primary" : "bg-white text-secondary border-[var(--divider)] hover:border-primary hover:text-primary"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          {available.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{available.map(renderBadge)}</div>
          ) : (
            <div className="rounded-2xl border border-[var(--divider)] bg-white p-8 text-center">
              <p className="text-secondary text-sm">All available badges are unlocked.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
