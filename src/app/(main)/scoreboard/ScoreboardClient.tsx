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

  function renderPodium(entries: Entry[], metric: "streak" | "points") {
    const top3 = entries.slice(0, 3);
    const displayOrder: Entry[] = [];
    const rank2 = top3.find((e) => e.rank === 2);
    const rank1 = top3.find((e) => e.rank === 1);
    const rank3 = top3.find((e) => e.rank === 3);

    if (rank2) displayOrder.push(rank2);
    if (rank1) displayOrder.push(rank1);
    if (rank3) displayOrder.push(rank3);

    if (top3.length === 0) return null;

    return (
      <div className="flex items-end justify-center gap-3 sm:gap-6 pt-6 pb-6 px-4 bg-gradient-to-b from-[#FFF7F7] to-white border-b border-[var(--divider)]">
        {displayOrder.map((e) => {
          const isRank1 = e.rank === 1;
          const isRank2 = e.rank === 2;
          const heightClass = isRank1
            ? "h-36 sm:h-40 bg-[#FFF7F7] border-[#D0021B]/20 shadow-sm"
            : isRank2
            ? "h-28 sm:h-32 bg-white"
            : "h-24 sm:h-28 bg-white";
          const medalEmoji = isRank1 ? "🥇" : isRank2 ? "🥈" : "🥉";

          return (
            <div
              key={e.rank}
              className={`flex flex-col items-center justify-end rounded-2xl p-3 border border-[var(--divider)] text-center transition-all w-24 sm:w-28 ${heightClass}`}
            >
              <div className="relative mb-2 shrink-0">
                {e.avatarUrl ? (
                  <img
                    src={e.avatarUrl}
                    alt=""
                    className="w-12 h-12 rounded-full object-cover border-2 border-[#D0021B]/20 bg-[var(--divider)]"
                  />
                ) : (
                  <span className="w-12 h-12 rounded-full bg-[#D0021B]/10 flex items-center justify-center text-[#D0021B] text-base font-bold">
                    {(e.displayName || "?").charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="absolute -bottom-1.5 -right-1 text-base">{medalEmoji}</span>
              </div>
              <h4 className="font-heading font-bold text-xs text-charcoal truncate w-full leading-tight">
                {e.displayName}
              </h4>
              <p className="text-secondary text-[10px] truncate w-full mt-0.5">{e.level ?? "N5"}</p>
              <span className="font-bold text-[#D0021B] text-xs mt-1">
                {metric === "streak" ? `${e.streak} days` : `${e.points} pts`}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Streaks */}
      <section className="rounded-bento border border-[var(--divider)] bg-white overflow-hidden">
        <h2 className="font-heading font-semibold text-charcoal px-4 py-3 border-b border-[var(--divider)] bg-base/50">
          Top streaks
        </h2>
        {renderPodium(byStreak, "streak")}
        {byStreak.length > 3 && (
          <ul className="divide-y divide-[var(--divider)]">
            {byStreak.slice(3).map((e) => (
              <li key={`streak-${e.rank}`} className="flex items-center gap-4 px-4 py-3">
                <span className="text-sm font-bold text-secondary w-8 text-center">{e.rank}</span>
                {e.avatarUrl ? (
                  <img src={e.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0 bg-[var(--divider)]" />
                ) : (
                  <span className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold flex-shrink-0">
                    {(e.displayName || "?").charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-charcoal truncate">{e.displayName}</p>
                  {e.level && <p className="text-xs text-secondary">{e.level}</p>}
                </div>
                <span className="font-semibold text-charcoal text-sm">{e.streak} days</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Top Points */}
      <section className="rounded-bento border border-[var(--divider)] bg-white overflow-hidden">
        <h2 className="font-heading font-semibold text-charcoal px-4 py-3 border-b border-[var(--divider)] bg-base/50">
          Top points
        </h2>
        {renderPodium(byPoints, "points")}
        {byPoints.length > 3 && (
          <ul className="divide-y divide-[var(--divider)]">
            {byPoints.slice(3).map((e) => (
              <li key={`points-${e.rank}`} className="flex items-center gap-4 px-4 py-3">
                <span className="text-sm font-bold text-secondary w-8 text-center">{e.rank}</span>
                {e.avatarUrl ? (
                  <img src={e.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0 bg-[var(--divider)]" />
                ) : (
                  <span className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold flex-shrink-0">
                    {(e.displayName || "?").charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-charcoal truncate">{e.displayName}</p>
                  {e.level && <p className="text-xs text-secondary">{e.level}</p>}
                </div>
                <span className="font-semibold text-charcoal text-sm">{e.points} pts</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
