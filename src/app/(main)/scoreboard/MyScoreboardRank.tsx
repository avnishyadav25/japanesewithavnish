"use client";

import { useEffect, useState } from "react";

type MyEntry = { rank: number; displayName: string; avatarUrl: string | null; level: string | null; streak: number; points: number };

/**
 * Personalized "your rank" banner, layered on top of the server-rendered public top-50 list.
 * Split out as its own client component (rather than making the whole page client-rendered like
 * the old ScoreboardClient) so the top-50 list itself is real, crawlable HTML — this banner is
 * the only part that genuinely needs the request's session cookie.
 */
export function MyScoreboardRank({ metric }: { metric: "streak" | "points" }) {
  const [entry, setEntry] = useState<MyEntry | null>(null);

  useEffect(() => {
    fetch(`/api/scoreboard?limit=1&type=${metric === "streak" ? "streaks" : "points"}`)
      .then((r) => r.json())
      .then((data) => setEntry(data?.me?.[metric === "streak" ? "byStreak" : "byPoints"] ?? null))
      .catch(() => setEntry(null));
  }, [metric]);

  if (!entry) return null;

  const label = metric === "streak" ? "days" : "pts";
  const value = metric === "streak" ? entry.streak : entry.points;

  return (
    <div className="m-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-3">
      <span className="text-xs font-black text-primary w-10">#{entry.rank}</span>
      {entry.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={entry.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0 bg-[var(--divider)]" />
      ) : (
        <span className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary text-sm font-bold flex-shrink-0">
          {(entry.displayName || "?").charAt(0).toUpperCase()}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-heading font-bold text-charcoal text-sm truncate">Your rank</p>
        <p className="text-xs text-secondary truncate">{entry.displayName} · {entry.level ?? "N5"}</p>
      </div>
      <span className="font-bold text-primary text-sm whitespace-nowrap">{value} {label}</span>
    </div>
  );
}
