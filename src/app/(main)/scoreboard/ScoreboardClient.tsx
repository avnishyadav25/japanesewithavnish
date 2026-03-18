"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Entry = {
  rank: number;
  displayName: string;
  avatarUrl: string | null;
  level: string | null;
  streak: number;
  points: number;
};

export function ScoreboardClient() {
  const [byStreak, setByStreak] = useState<Entry[]>([]);
  const [byPoints, setByPoints] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/scoreboard")
      .then((r) => r.json())
      .then((data) => {
        setByStreak(data.byStreak ?? []);
        setByPoints(data.byPoints ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-bento border border-[var(--divider)] bg-white p-6">
        <p className="text-secondary text-sm">Loading scoreboard…</p>
      </div>
    );
  }

  const empty = byStreak.length === 0 && byPoints.length === 0;
  if (empty) {
    return (
      <div className="rounded-bento border border-[var(--divider)] bg-white p-6">
        <p className="text-secondary text-sm">No one on the board yet. Turn on &quot;Show me on the scoreboard&quot; in <Link href="/account" className="text-primary hover:underline">My settings</Link> and keep your streak or earn points to appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-bento border border-[var(--divider)] bg-white overflow-hidden">
        <h2 className="font-heading font-semibold text-charcoal px-4 py-3 border-b border-[var(--divider)] bg-base/50">
          Top streaks
        </h2>
        <ul className="divide-y divide-[var(--divider)]">
          {byStreak.map((e) => (
            <li key={`streak-${e.rank}`} className="flex items-center gap-4 px-4 py-3">
              <span className="text-lg font-bold text-primary w-8">{e.rank}</span>
              {e.avatarUrl ? (
                <img src={e.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0 bg-[var(--divider)]" />
              ) : (
                <span className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold flex-shrink-0">
                  {(e.displayName || "?").charAt(0).toUpperCase()}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-charcoal truncate">{e.displayName}</p>
                {e.level && (
                  <p className="text-xs text-secondary">{e.level}</p>
                )}
              </div>
              <span className="font-semibold text-charcoal">{e.streak} days</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-bento border border-[var(--divider)] bg-white overflow-hidden">
        <h2 className="font-heading font-semibold text-charcoal px-4 py-3 border-b border-[var(--divider)] bg-base/50">
          Top points
        </h2>
        <ul className="divide-y divide-[var(--divider)]">
          {byPoints.map((e) => (
            <li key={`points-${e.rank}`} className="flex items-center gap-4 px-4 py-3">
              <span className="text-lg font-bold text-primary w-8">{e.rank}</span>
              {e.avatarUrl ? (
                <img src={e.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0 bg-[var(--divider)]" />
              ) : (
                <span className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold flex-shrink-0">
                  {(e.displayName || "?").charAt(0).toUpperCase()}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-charcoal truncate">{e.displayName}</p>
                {e.level && (
                  <p className="text-xs text-secondary">{e.level}</p>
                )}
              </div>
              <span className="font-semibold text-charcoal">{e.points} pts</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
