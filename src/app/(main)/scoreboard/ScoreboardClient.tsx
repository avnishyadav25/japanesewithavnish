"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Entry = {
  rank: number;
  email?: string;
  displayName: string;
  avatarUrl: string | null;
  level: string | null;
  streak: number;
  points: number;
};

export function ScoreboardClient() {
  const [byStreak, setByStreak] = useState<Entry[]>([]);
  const [byPoints, setByPoints] = useState<Entry[]>([]);
  const [me, setMe] = useState<{ byStreak: Entry | null; byPoints: Entry | null }>({ byStreak: null, byPoints: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/scoreboard?limit=50")
      .then((r) => r.json())
      .then((data) => {
        setByStreak(data.byStreak ?? []);
        setByPoints(data.byPoints ?? []);
        setMe(data.me ?? { byStreak: null, byPoints: null });
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

  function avatar(entry: Entry, size = "w-9 h-9") {
    return (
      entry.avatarUrl ? (
        <img src={entry.avatarUrl} alt="" className={`${size} rounded-full object-cover flex-shrink-0 bg-[var(--divider)]`} />
      ) : (
        <span className={`${size} rounded-full bg-primary/15 flex items-center justify-center text-primary text-sm font-bold flex-shrink-0`}>
          {(entry.displayName || "?").charAt(0).toUpperCase()}
        </span>
      )
    );
  }

  function renderList(entries: Entry[], metric: "streak" | "points", myEntry: Entry | null) {
    const topMetric = metric === "streak" ? "days" : "pts";

    return (
      <>
        {myEntry && (
          <div className="m-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-3">
            <span className="text-xs font-black text-primary w-10">#{myEntry.rank}</span>
            {avatar(myEntry, "w-10 h-10")}
            <div className="flex-1 min-w-0">
              <p className="font-heading font-bold text-charcoal text-sm truncate">Your rank</p>
              <p className="text-xs text-secondary truncate">{myEntry.displayName} · {myEntry.level ?? "N5"}</p>
            </div>
            <span className="font-bold text-primary text-sm whitespace-nowrap">
              {metric === "streak" ? myEntry.streak : myEntry.points} {topMetric}
            </span>
          </div>
        )}

        <ul className="divide-y divide-[var(--divider)]">
          {entries.map((e) => (
            <li key={`${metric}-${e.rank}-${e.displayName}`} className="flex items-center gap-4 px-4 py-3">
              <span className="text-sm font-bold text-secondary w-9 text-center">#{e.rank}</span>
              {avatar(e)}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-charcoal truncate">{e.displayName}</p>
                {e.level && <p className="text-xs text-secondary">{e.level}</p>}
              </div>
              <div className="text-right">
                <span className="font-semibold text-charcoal text-sm">{metric === "streak" ? e.streak : e.points} {topMetric}</span>
                <p className="text-[10px] text-secondary">{metric === "streak" ? `${e.points} pts` : `${e.streak} days`}</p>
              </div>
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Streaks */}
      <section className="rounded-bento border border-[var(--divider)] bg-white overflow-hidden">
        <h2 className="font-heading font-semibold text-charcoal px-4 py-3 border-b border-[var(--divider)] bg-base/50">Top 50 streaks</h2>
        {renderList(byStreak, "streak", me.byStreak)}
      </section>

      {/* Top Points */}
      <section className="rounded-bento border border-[var(--divider)] bg-white overflow-hidden">
        <h2 className="font-heading font-semibold text-charcoal px-4 py-3 border-b border-[var(--divider)] bg-base/50">Top 50 points</h2>
        {renderList(byPoints, "points", me.byPoints)}
      </section>
    </div>
  );
}
