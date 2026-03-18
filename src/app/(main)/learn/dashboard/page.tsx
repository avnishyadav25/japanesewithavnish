"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type ProgressData = {
  profile: { email: string; recommended_level: string | null; display_name: string | null } | null;
  stats: {
    learnedCount: number;
    dueCount: number;
    rewardCount?: number;
    currentStreak?: number;
    longestStreak?: number;
    totalPoints?: number;
    pointsToday?: number;
    lessonsCompleted?: number;
  };
  curriculum?: {
    nextLesson: { id: string; title: string; lessonCode: string; submoduleTitle: string; moduleTitle: string; levelCode: string } | null;
    lessonsCompleted: number;
  };
  milestones?: { code: string; name: string; description: string | null; points: number; earnedAt: string }[];
  dailyRoutine?: {
    baseline: { min_reading: number; min_review: number };
    current: { lessonsToday: number; reviewsToday: number };
    items: { label: string; current: number; required: number; done: boolean }[];
  } | null;
};

export default function LearnDashboardPage() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aiSteps, setAiSteps] = useState<string[]>([]);
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetch("/api/activity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "activity" }) }).catch(() => {});
    Promise.all([
      fetch("/api/learn/progress").then((r) => r.json()),
      fetch("/api/learn/milestones").then((r) => r.json()).catch(() => ({ milestones: [] })),
    ]).then(([d, m]) => {
      if (d.error && d.profile === undefined) {
        setError(d.error);
        setData(null);
      } else {
        setData({
          profile: d.profile ?? null,
          stats: d.stats ?? { learnedCount: 0, dueCount: 0, rewardCount: 0, currentStreak: 0, longestStreak: 0, totalPoints: 0, pointsToday: 0 },
          curriculum: d.curriculum ?? { nextLesson: null, lessonsCompleted: 0 },
          dailyRoutine: d.dailyRoutine ?? null,
          milestones: Array.isArray(m.milestones) ? m.milestones : [],
        });
      }
    })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  function fetchAiSuggestions() {
    if (aiLoading || !data) return;
    setAiLoading(true);
    Promise.all([
      fetch("/api/ai/next-steps", { method: "POST" }).then((r) => r.json()).then((d) => setAiSteps(Array.isArray(d.steps) ? d.steps : [])).catch(() => setAiSteps([])),
      fetch("/api/ai/daily-checkpoint", { method: "POST" }).then((r) => r.json()).then((d) => setAiSummary(typeof d.summary === "string" ? d.summary : "")).catch(() => setAiSummary("")),
    ]).finally(() => setAiLoading(false));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--base)] flex items-center justify-center">
        <p className="text-secondary">Loading…</p>
      </div>
    );
  }

  if (error === "Unauthorized" || (error && !data)) {
    return (
      <div className="min-h-screen bg-[var(--base)] flex flex-col items-center justify-center px-4">
        <h1 className="font-heading text-2xl font-bold text-charcoal mb-2">My Progress</h1>
        <p className="text-secondary text-center mb-6">Sign in to see your progress and reviews.</p>
        <Link href="/login?redirect=/learn/dashboard" className="btn-primary">
          Log in
        </Link>
        <Link href="/learn" className="mt-4 text-primary text-sm hover:underline">
          Browse Learn →
        </Link>
      </div>
    );
  }

  const { profile, stats, curriculum, dailyRoutine, milestones } = data!;
  const nextLesson = curriculum?.nextLesson ?? null;

  return (
    <div className="min-h-screen bg-[var(--base)]">
      <div className="max-w-[1100px] mx-auto px-4 py-8">
        <h1 className="font-heading text-3xl font-bold text-charcoal mb-2">My Progress</h1>
        <p className="text-secondary mb-8">
          Your level and activity. Take the <Link href="/quiz" className="text-primary hover:underline">placement quiz</Link> to set your level.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="rounded-bento border border-[var(--divider)] bg-white p-6">
            <h2 className="font-heading font-semibold text-charcoal mb-1">Recommended level</h2>
            <p className="text-2xl font-bold text-primary">
              {profile?.recommended_level ?? "—"}
            </p>
            <p className="text-secondary text-sm mt-1">From placement quiz</p>
          </div>
          <div className="rounded-bento border border-[var(--divider)] bg-white p-6">
            <h2 className="font-heading font-semibold text-charcoal mb-1">Streak</h2>
            <p className="text-2xl font-bold text-charcoal">{stats.currentStreak ?? 0} days</p>
            <p className="text-secondary text-sm mt-1">Best: {stats.longestStreak ?? 0} days</p>
          </div>
          <div className="rounded-bento border border-[var(--divider)] bg-white p-6">
            <h2 className="font-heading font-semibold text-charcoal mb-1">Items learned</h2>
            <p className="text-2xl font-bold text-charcoal">{stats.learnedCount}</p>
            <p className="text-secondary text-sm mt-1">Marked as learned</p>
          </div>
          <div className="rounded-bento border border-[var(--divider)] bg-white p-6">
            <h2 className="font-heading font-semibold text-charcoal mb-1">Reviews due</h2>
            <p className="text-2xl font-bold text-charcoal">{stats.dueCount}</p>
            <p className="text-secondary text-sm mt-1">
              {stats.dueCount > 0 ? (
                <Link href="/review" className="text-primary hover:underline">Do review →</Link>
              ) : (
                "None right now"
              )}
            </p>
          </div>
          <div className="rounded-bento border border-[var(--divider)] bg-white p-6">
            <h2 className="font-heading font-semibold text-charcoal mb-1">Rewards</h2>
            <p className="text-2xl font-bold text-primary">{stats.totalPoints ?? 0} pts</p>
            <p className="text-secondary text-sm mt-1">Earned today: {stats.pointsToday ?? 0} pts</p>
          </div>
        </div>

        {/* Today's routine */}
        {dailyRoutine && (
          <div className="rounded-bento border border-[var(--divider)] bg-white p-6 mb-8">
            <h2 className="font-heading font-semibold text-charcoal mb-3">Today&apos;s routine</h2>
            <ul className="space-y-2">
              {dailyRoutine.items.map((item) => (
                <li key={item.label} className="flex items-center gap-2 text-sm">
                  <span className={item.done ? "text-green-600" : "text-secondary"} aria-hidden>
                    {item.done ? "✓" : "○"}
                  </span>
                  <span className="text-charcoal">{item.label}: {item.current} / {item.required}</span>
                  {!item.done && item.label === "Reviews" && (
                    <Link href="/review" className="text-primary text-xs hover:underline ml-1">Do reviews →</Link>
                  )}
                  {!item.done && item.label === "Lessons" && nextLesson && (
                    <Link href={`/learn/curriculum/lesson/${nextLesson.id}`} className="text-primary text-xs hover:underline ml-1">Continue lesson →</Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Next steps */}
        <div className="rounded-bento border border-[var(--divider)] bg-white p-6 mb-8">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="font-heading font-semibold text-charcoal">
              {aiSteps.length > 0 ? "Suggested next steps" : "Next steps"}
            </h2>
            <button
              type="button"
              onClick={fetchAiSuggestions}
              disabled={aiLoading}
              className="text-primary text-sm font-medium hover:underline disabled:opacity-60"
            >
              {aiLoading ? "Thinking…" : "Suggest with AI"}
            </button>
          </div>
          {aiSteps.length > 0 ? (
            <ul className="space-y-2">
              {aiSteps.map((step, i) => (
                <li key={i} className="text-charcoal text-sm flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {nextLesson && (
                <li>
                  <Link href={`/learn/curriculum/lesson/${nextLesson.id}`} className="inline-flex items-center px-4 py-2 rounded-bento bg-primary text-white font-medium text-sm hover:bg-primary/90 transition">
                    Continue: {nextLesson.title}
                  </Link>
                </li>
              )}
              {(stats.dueCount ?? 0) > 0 && (
                <li>
                  <Link href="/review" className="inline-flex items-center px-4 py-2 rounded-bento bg-primary/80 text-white font-medium text-sm hover:bg-primary/90 transition">
                    Do {stats.dueCount} reviews
                  </Link>
                </li>
              )}
              <li>
                <Link href="/learn/curriculum" className="inline-flex items-center px-4 py-2 rounded-bento border-2 border-[var(--divider)] text-charcoal font-medium text-sm hover:border-primary hover:text-primary transition">
                  Browse curriculum
                </Link>
              </li>
              <li>
                <Link href="/learn" className="inline-flex items-center px-4 py-2 rounded-bento border-2 border-[var(--divider)] text-charcoal font-medium text-sm hover:border-primary hover:text-primary transition">
                  Continue with Learn
                </Link>
              </li>
              <li>
                <Link href="/tutor" className="inline-flex items-center px-4 py-2 rounded-bento border-2 border-[var(--divider)] text-charcoal font-medium text-sm hover:border-primary hover:text-primary transition">
                  Practice with Nihongo Navi
                </Link>
              </li>
              {!profile?.recommended_level && (
                <li>
                  <Link href="/quiz" className="inline-flex items-center px-4 py-2 rounded-bento border-2 border-[var(--divider)] text-charcoal font-medium text-sm hover:border-primary hover:text-primary transition">
                    Retake placement quiz
                  </Link>
                </li>
              )}
            </ul>
          )}
        </div>

        {/* Milestones */}
        {milestones && milestones.length > 0 && (
          <div className="rounded-bento border border-[var(--divider)] bg-white p-6 mb-8">
            <h2 className="font-heading font-semibold text-charcoal mb-3">Milestones</h2>
            <ul className="space-y-2">
              {milestones.slice(0, 5).map((m) => (
                <li key={m.code} className="flex items-center gap-2 text-sm">
                  <span className="text-primary font-medium">✓</span>
                  <span className="text-charcoal">{m.name}</span>
                  {m.points > 0 && <span className="text-secondary text-xs">+{m.points} pts</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Daily checkpoint */}
        <div className="rounded-bento border border-[var(--divider)] bg-[#FFF7F7] p-6 mb-8">
          <h2 className="font-heading font-semibold text-charcoal mb-2">Today</h2>
          {aiSummary ? (
            <p className="text-charcoal text-sm italic">&ldquo;{aiSummary}&rdquo;</p>
          ) : (
            <p className="text-charcoal text-sm">
              You logged in. You earned <strong>{stats.pointsToday ?? 0}</strong> points today. You have <strong>{stats.dueCount ?? 0}</strong> reviews due.
            </p>
          )}
          <button
            type="button"
            onClick={fetchAiSuggestions}
            disabled={aiLoading}
            className="text-primary text-xs font-medium hover:underline mt-2 disabled:opacity-60"
          >
            {aiLoading ? "Thinking…" : "Get AI summary"}
          </button>
        </div>

        {/* Help: How rewards work */}
        <div className="rounded-bento border border-[var(--divider)] bg-white p-6 mb-8">
          <h2 className="font-heading font-semibold text-charcoal mb-2">Help: How rewards work</h2>
          <ul className="text-secondary text-sm space-y-2 list-disc list-inside">
            <li><strong className="text-charcoal">Daily login</strong> — 10 points each day you visit.</li>
            <li><strong className="text-charcoal">Exercises</strong> — 5 points when you complete a lesson or activity.</li>
            <li><strong className="text-charcoal">Streaks</strong> — Keep studying on consecutive days to grow your streak; milestone rewards may apply.</li>
            <li><strong className="text-charcoal">Total & today</strong> — Your total points and &quot;Earned today&quot; are shown in the Rewards card above.</li>
            <li><strong className="text-charcoal">Scoreboard</strong> — In <Link href="/account" className="text-primary hover:underline">Settings</Link> you can turn on &quot;Show me on the scoreboard&quot; to appear on the public leaderboard. Top 10 may be eligible for hampers.</li>
          </ul>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/learn" className="btn-primary">
            Browse Learn
          </Link>
          <Link href="/tutor" className="px-4 py-2 rounded-bento border-2 border-[var(--divider)] text-charcoal hover:border-primary transition">
            Nihongo Navi (Tutor)
          </Link>
          <Link href="/review" className="px-4 py-2 rounded-bento border-2 border-[var(--divider)] text-charcoal hover:border-primary transition">
            Review
          </Link>
          <Link href="/quiz" className="text-primary text-sm font-medium hover:underline self-center">
            Retake placement quiz →
          </Link>
        </div>
      </div>
    </div>
  );
}
