"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface LearnBundleCtaProps {
  level: string;
}

export function LearnBundleCta({ level }: LearnBundleCtaProps) {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.profile) {
          const now = new Date();
          const premium =
            data.profile.is_lifetime ||
            (data.profile.premium_until && new Date(data.profile.premium_until) > now);
          setIsPremium(Boolean(premium));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="card p-6 bg-white border border-[var(--divider)] animate-pulse h-32 flex items-center justify-center">
        <span className="text-xs text-secondary">Checking access pass status...</span>
      </div>
    );
  }

  if (isPremium) {
    return (
      <div className="card p-6 bg-white border border-[var(--divider)] rounded-3xl shadow-sm space-y-4">
        <div>
          <h3 className="font-heading text-lg font-black text-charcoal">Continue your learning path</h3>
          <p className="text-secondary text-xs mt-1">
            Pick up from your next lesson in the curriculum. Move sequentially to earn daily streaks and badges!
          </p>
        </div>
        <div className="flex">
          <Link
            href="/learn/dashboard"
            className="btn-primary h-11 px-5 rounded-xl text-xs font-bold font-heading flex items-center justify-center"
          >
            Continue Learning →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6 bg-white border border-[var(--divider)] rounded-3xl shadow-sm space-y-4">
      <div>
        <h3 className="font-heading text-lg font-black text-charcoal">Want unlimited Japanese learning?</h3>
        <p className="text-secondary text-xs mt-1">
          Premium unlocks all lessons, practice drills, advanced mock tests, and streak freeze protections.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/#pricing"
          className="btn-primary h-11 px-5 rounded-xl text-xs font-bold font-heading flex items-center justify-center"
        >
          Upgrade to Premium — ₹99 / 30 days
        </Link>
        <Link
          href="/pricing"
          className="btn-secondary h-11 px-5 rounded-xl text-xs font-bold font-heading flex items-center justify-center"
        >
          View Premium Plans
        </Link>
      </div>
    </div>
  );
}
