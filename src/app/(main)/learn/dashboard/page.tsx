"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type ProgressData = {
  profile: {
    email: string;
    recommended_level: string | null;
    display_name: string | null;
    xp?: number;
    points?: number;
    streak_freezes?: number;
    premium_until?: string | null;
    is_lifetime?: boolean;
    subscription_status?: string | null;
    trial_ends_at?: string | null;
  } | null;
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
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const [points, setPoints] = useState(0);
  const [streakFreezes, setStreakFreezes] = useState(0);
  const [badges, setBadges] = useState<{ slug: string; name: string; iconEmoji: string | null; isEarned: boolean }[]>([]);
  const [purchasing, setPurchasing] = useState(false);
  const [rewardsOpen, setRewardsOpen] = useState(false);
  const [countdownText, setCountdownText] = useState("");

  const fetchDashboardData = () => {
    Promise.all([
      fetch("/api/learn/progress").then((r) => r.json()),
      fetch("/api/learn/badges").then((r) => r.json()).catch(() => ({ badges: [] })),
    ])
      .then(([d, bData]) => {
        if (d.error && d.profile === undefined) {
          setError(d.error);
          setData(null);
        } else {
          setData({
            profile: d.profile ?? null,
            stats: d.stats ?? { learnedCount: 0, dueCount: 0, rewardCount: 0, currentStreak: 0, longestStreak: 0, totalPoints: 0, pointsToday: 0 },
            curriculum: d.curriculum ?? { nextLesson: null, lessonsCompleted: 0 },
            dailyRoutine: d.dailyRoutine ?? null,
            milestones: [],
          });
          setPoints(d.profile?.points ?? d.stats?.totalPoints ?? 0);
          setStreakFreezes(d.profile?.streak_freezes ?? 0);
          setBadges(bData.badges ?? []);
        }
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetch("/api/activity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "activity" }) }).catch(() => {});
    fetchDashboardData();
  }, []);

  // Update IST midnight countdown timer
  useEffect(() => {
    const calculateCountdown = () => {
      const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      const midnightIST = new Date(nowIST);
      midnightIST.setHours(24, 0, 0, 0);
      const diffMs = midnightIST.getTime() - nowIST.getTime();
      const hrs = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      setCountdownText(`${hrs}h ${mins}m`);
    };
    calculateCountdown();
    const interval = setInterval(calculateCountdown, 60000);
    return () => clearInterval(interval);
  }, []);

  function fetchAiSuggestions() {
    if (aiLoading || !data) return;
    setAiLoading(true);
    fetch("/api/ai/daily-checkpoint", { method: "POST" })
      .then((r) => r.json())
      .then((d) => setAiSummary(typeof d.summary === "string" ? d.summary : ""))
      .catch(() => setAiSummary(""))
      .finally(() => setAiLoading(false));
  }

  async function handleBuyFreeze() {
    if (purchasing) return;
    setPurchasing(true);
    try {
      const res = await fetch("/api/learn/shop/buy-freeze", { method: "POST" });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Purchase failed");
      setPoints(resData.points);
      setStreakFreezes(resData.streakFreezes);
      fetchDashboardData();
      alert("🎉 Streak Freeze purchased successfully! Deducted 100 points.");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setPurchasing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--base)] flex items-center justify-center">
        <p className="text-secondary">Loading learning dashboard…</p>
      </div>
    );
  }

  if (error === "Unauthorized" || (error && !data)) {
    return (
      <div className="min-h-screen bg-[var(--base)] flex flex-col items-center justify-center px-4">
        <h1 className="font-heading text-2xl font-bold text-charcoal mb-2">My Learning Dashboard</h1>
        <p className="text-secondary text-center mb-6">Sign in to see your roadmap, streaks, and badges.</p>
        <Link href="/login?redirect=/learn/dashboard" className="btn-primary">
          Log in
        </Link>
      </div>
    );
  }

  const { profile, stats, curriculum, dailyRoutine } = data!;
  const nextLesson = curriculum?.nextLesson ?? null;

  // Subscription plan states evaluation
  const now = new Date();
  const isPremium = Boolean(profile?.is_lifetime || (profile?.premium_until && new Date(profile.premium_until) > now));
  const isTrial = !isPremium && Boolean(profile?.subscription_status === "trialing" && profile?.trial_ends_at && new Date(profile.trial_ends_at) > now);
  const isExpired = !isPremium && !isTrial && Boolean(profile?.premium_until && new Date(profile.premium_until) < now);

  const trialDaysRemaining = isTrial && profile?.trial_ends_at
    ? Math.max(Math.ceil((new Date(profile.trial_ends_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)), 1)
    : 0;

  // Dynamic Level progress computation
  const levelTotals: Record<string, number> = { N5: 35, N4: 40, N3: 45, N2: 50, N1: 55 };
  const currentLvl = profile?.recommended_level || "N5";
  const totalLessonsInLevel = levelTotals[currentLvl] || 35;
  const completedInLevel = stats.lessonsCompleted ?? 0;
  const progressPercent = Math.min(Math.round((completedInLevel / totalLessonsInLevel) * 100), 100);

  // Dynamic 6 modules list progress
  const modulesList = [
    { name: "Module 1: Japanese Writing System", pct: completedInLevel >= 5 ? 100 : completedInLevel * 20 },
    { name: "Module 2: Sentence Foundation", pct: completedInLevel >= 12 ? 100 : completedInLevel >= 5 ? Math.round(((completedInLevel - 5) / 7) * 100) : 0 },
    { name: "Module 3: Verbs and Daily Actions", pct: completedInLevel >= 20 ? 100 : completedInLevel >= 12 ? Math.round(((completedInLevel - 12) / 8) * 100) : 0 },
    { name: "Module 4: Adjectives and Descriptions", pct: completedInLevel >= 27 ? 100 : completedInLevel >= 20 ? Math.round(((completedInLevel - 20) / 7) * 100) : 0 },
    { name: "Module 5: Vocabulary and Kanji", pct: completedInLevel >= 32 ? 100 : completedInLevel >= 27 ? Math.round(((completedInLevel - 27) / 5) * 100) : 0 },
    { name: "Module 6: Reading + Listening", pct: completedInLevel >= 35 ? 100 : completedInLevel >= 32 ? Math.round(((completedInLevel - 32) / 3) * 100) : 0 },
  ];

  // Daily consumed lessons (Limit is 2 per day for free users)
  const lessonsToday = dailyRoutine?.current?.lessonsToday ?? 0;
  const freeLessonsRemaining = Math.max(2 - lessonsToday, 0);

  return (
    <div className="min-h-screen bg-[var(--base)]">
      <div className="max-w-[1200px] mx-auto px-4 py-8 space-y-8">
        
        {/* Dashboard Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 bg-white p-6 border border-[var(--divider)] rounded-3xl shadow-card">
          <div className="space-y-1">
            <h1 className="font-heading text-3xl font-black text-charcoal">My Learning Dashboard</h1>
            <p className="text-secondary text-sm">
              Continue your Japanese journey. Build streaks, earn rewards, and stay on track.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {isPremium ? (
              <div className="flex flex-col items-end gap-1.5">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#FAF8F5] border border-[#C8A35F] text-[#C8A35F]">
                  👑 Premium Active · Unlimited access
                </span>
                <Link href="/pricing" className="text-xs font-bold text-primary hover:underline">
                  Manage Subscription
                </Link>
              </div>
            ) : isTrial ? (
              <div className="flex flex-col items-end gap-1.5">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#FFF8E8] text-[#C8A35F]">
                  ⭐ Premium Trial Active · {trialDaysRemaining} days left
                </span>
                <Link href="/pricing" className="text-xs font-bold text-primary hover:underline">
                  Choose Plan
                </Link>
              </div>
            ) : isExpired ? (
              <div className="flex flex-col items-end gap-1.5">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#FFF7F7] text-[#D0021B]">
                  ⚠️ Premium Expired
                </span>
                <Link href="/pricing" className="btn-primary text-xs px-4 py-1.5 h-auto rounded-full font-bold">
                  Renew Premium
                </Link>
              </div>
            ) : (
              <div className="flex flex-col items-end gap-1.5">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#FFF7F7] text-[#D0021B]">
                  Free Plan · 2 lessons/day
                </span>
                <Link href="/pricing" className="btn-primary text-xs px-4 py-1.5 h-auto rounded-full font-bold">
                  Upgrade to Premium
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Free Plan Upgrade Card Promotion */}
        {!isPremium && !isTrial && (
          <div className="bg-gradient-to-r from-[#FFF7F7] to-white border border-[#D0021B]/15 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm">
            <div className="space-y-2">
              <h3 className="font-heading text-lg font-black text-charcoal">Unlock unlimited Japanese learning</h3>
              <p className="text-secondary text-sm max-w-xl leading-relaxed">
                Premium includes: unlimited lessons, writing &amp; listening practice drills, full JLPT N5-N1 access, mock tests, and advanced progress tracking.
              </p>
            </div>
            <div className="flex flex-col sm:items-end gap-1 shrink-0 w-full sm:w-auto">
              <Link href="/pricing" className="btn-primary text-center px-6 py-2.5 rounded-xl font-bold text-sm">
                Upgrade Now (₹99 / 30 days)
              </Link>
            </div>
          </div>
        )}

        {/* Section 1: Main Progress Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-3xl border border-[var(--divider)] bg-white p-5 flex flex-col justify-between">
            <div>
              <h3 className="text-secondary text-xs font-bold uppercase tracking-wider mb-1">Current Level</h3>
              <p className="text-xl font-black text-charcoal">{currentLvl} Beginner</p>
              <p className="text-xs text-secondary mt-1">From placement quiz</p>
            </div>
            <Link href="/learn/onboarding" className="text-xs text-primary font-bold hover:underline mt-4 block">
              Change level →
            </Link>
          </div>

          <div className="rounded-3xl border border-[var(--divider)] bg-white p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-secondary text-xs font-bold uppercase tracking-wider">Daily Streak</h3>
                <span className="text-lg">🔥</span>
              </div>
              <p className="text-xl font-black text-charcoal">{stats.currentStreak ?? 0} days</p>
              <p className="text-xs text-secondary mt-1">Best streak: {stats.longestStreak ?? 0} days</p>
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--divider)] bg-white p-5 flex flex-col justify-between">
            <div>
              <h3 className="text-secondary text-xs font-bold uppercase tracking-wider mb-1">Lessons Completed</h3>
              <p className="text-xl font-black text-charcoal">{completedInLevel} / {totalLessonsInLevel}</p>
              <div className="w-full bg-[var(--divider)] h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-primary h-full transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
            <span className="text-xs text-secondary mt-4 block font-semibold">{progressPercent}% complete</span>
          </div>

          <div className="rounded-3xl border border-[var(--divider)] bg-white p-5 flex flex-col justify-between">
            <div>
              <h3 className="text-secondary text-xs font-bold uppercase tracking-wider mb-1">Rewards</h3>
              <p className="text-xl font-black text-primary">{points} pts</p>
              <p className="text-xs text-secondary mt-1">XP earned: {profile?.xp ?? 0}</p>
            </div>
            <Link href="/scoreboard" className="text-xs text-primary font-bold hover:underline mt-4 block">
              View badges →
            </Link>
          </div>
        </div>

        {/* Section 2: Today's Learning Action Card */}
        <div className="bg-white border border-[var(--divider)] rounded-3xl p-6 sm:p-8 shadow-sm">
          {!isPremium && !isTrial ? (
            <div className="space-y-6">
              <div className="flex justify-between items-start border-b border-[var(--divider)] pb-4">
                <div>
                  <h2 className="font-heading text-lg font-black text-charcoal">Today&apos;s Free Lessons</h2>
                  <p className="text-secondary text-sm mt-0.5">
                    Free users get 2 lessons daily. Upgrade for unlimited access.
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs text-secondary block">Next reset in</span>
                  <span className="font-mono text-sm font-bold text-charcoal">{countdownText}</span>
                </div>
              </div>

              {freeLessonsRemaining > 0 ? (
                <div className="space-y-4">
                  <p className="text-sm text-secondary">
                    You have <strong className="text-charcoal font-semibold">{freeLessonsRemaining}</strong> free lessons remaining for today.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="border border-[var(--divider)] rounded-2xl p-4 flex flex-col justify-between min-h-[120px]">
                      <div>
                        <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full">Lesson 1</span>
                        <h4 className="font-heading font-bold text-sm text-charcoal mt-2">{nextLesson?.title || "Hiragana A–N Rows"}</h4>
                      </div>
                      <Link href={`/learn/curriculum/lesson/${nextLesson?.id || "N5"}`} className="btn-primary text-center py-2 text-xs font-bold rounded-xl mt-4 block">
                        Start Lesson
                      </Link>
                    </div>
                    <div className="border border-[var(--divider)] rounded-2xl p-4 flex flex-col justify-between min-h-[120px] opacity-75 bg-[#FAF8F5]">
                      <div>
                        <span className="px-2 py-0.5 bg-secondary/15 text-secondary text-[10px] font-bold rounded-full">Lesson 2</span>
                        <h4 className="font-heading font-bold text-sm text-secondary mt-2">Hiragana H–W Rows</h4>
                      </div>
                      <button disabled className="w-full text-center py-2 text-xs font-bold rounded-xl mt-4 bg-[var(--divider)] text-secondary cursor-not-allowed">
                        Sequential Locked
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 space-y-4 bg-[#FFF7F7] border border-primary/15 rounded-2xl">
                  <span className="text-4xl">🔒</span>
                  <h3 className="font-heading text-lg font-black text-charcoal">You&apos;ve completed today&apos;s 2 free lessons.</h3>
                  <p className="text-secondary text-sm max-w-md mx-auto leading-relaxed">
                    Your next lessons will unlock in <strong className="text-charcoal">{countdownText}</strong> (at midnight IST). Upgrade to Premium to study immediately.
                  </p>
                  <Link href="/pricing" className="btn-primary inline-block px-6 py-2.5 rounded-xl font-bold text-sm mt-2">
                    Upgrade to Premium
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <h2 className="font-heading text-lg font-black text-charcoal">Continue Learning</h2>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border border-[#C8A35F]/20 bg-[#FAF8F5] p-5 rounded-2xl">
                <div className="space-y-1">
                  <span className="px-2 py-0.5 bg-[#C8A35F]/10 text-[#C8A35F] text-[10px] font-bold rounded-full">Next Up</span>
                  <h4 className="font-heading font-bold text-base text-charcoal mt-2">{nextLesson?.title || "Hiragana A–N Rows"}</h4>
                  <p className="text-secondary text-xs">{nextLesson?.moduleTitle || "Japanese Writing System"} · {currentLvl}</p>
                </div>
                <div className="flex gap-3 shrink-0">
                  <Link href="/learn/curriculum" className="px-4 py-2 border border-[var(--divider)] rounded-xl font-semibold text-charcoal hover:bg-white text-xs transition">
                    Browse Curriculum
                  </Link>
                  <Link href={`/learn/curriculum/lesson/${nextLesson?.id || "N5"}`} className="btn-primary px-5 py-2 rounded-xl font-bold text-xs">
                    Continue Lesson
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Course Progress */}
        <div className="bg-white border border-[var(--divider)] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b border-[var(--divider)] pb-4">
            <div>
              <h2 className="font-heading text-lg font-black text-charcoal">{currentLvl} Course Progress</h2>
              <p className="text-secondary text-xs mt-0.5">{completedInLevel} of {totalLessonsInLevel} lessons completed</p>
            </div>
            <Link href="/learn/curriculum" className="text-xs font-bold text-primary hover:underline">
              Open Curriculum
            </Link>
          </div>

          <div className="w-full bg-[var(--divider)] h-2 rounded-full overflow-hidden">
            <div className="bg-primary h-full transition-all" style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {modulesList.map((m, i) => (
              <div key={i} className="flex justify-between items-center border border-[var(--divider)] rounded-xl p-3.5 bg-[var(--base)]">
                <span className="text-charcoal font-medium text-xs truncate max-w-[200px] sm:max-w-xs">{m.name}</span>
                <span className="font-bold text-xs text-primary">{m.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Recommended Next Steps */}
        <div className="bg-white border border-[var(--divider)] rounded-3xl p-6 shadow-sm">
          <h2 className="font-heading font-bold text-charcoal text-base mb-4">Recommended Next Steps</h2>
          <div className="flex flex-wrap gap-3">
            <Link href={`/learn/curriculum/lesson/${nextLesson?.id || "N5"}`} className="btn-primary text-xs px-5 py-2.5 rounded-xl font-bold">
              Continue Next Lesson
            </Link>
            <Link href="/learn/curriculum" className="px-5 py-2.5 border border-[var(--divider)] rounded-xl font-bold text-charcoal hover:bg-[var(--base)] text-xs transition">
              Browse Curriculum
            </Link>
            <Link href="/quiz" className="px-5 py-2.5 border border-[var(--divider)] rounded-xl font-bold text-charcoal hover:bg-[var(--base)] text-xs transition">
              Take Placement Quiz
            </Link>
            <Link href="/tutor" className="px-5 py-2.5 border border-[var(--divider)] rounded-xl font-bold text-charcoal hover:bg-[var(--base)] text-xs transition">
              Practice with Nihongo Navi
            </Link>
            {!isPremium && !isTrial && (
              <Link href="/pricing" className="px-5 py-2.5 bg-primary/10 border border-primary/20 text-primary rounded-xl font-bold text-xs hover:bg-primary/15 transition">
                Upgrade to Premium
              </Link>
            )}
          </div>
        </div>

        {/* Section 5: Daily Goal & Streak Freeze Shop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Daily Goal Card */}
          <div className="bg-white border border-[var(--divider)] rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[200px]">
            <div className="space-y-2">
              <h3 className="font-heading font-bold text-charcoal text-base">Daily Goal</h3>
              <p className="text-secondary text-sm">Goal: Complete 1 lesson or 1 practice today.</p>
              <p className="text-charcoal text-xs font-semibold mt-2">
                Status: {lessonsToday > 0 ? (
                  <span className="text-green-700 font-bold bg-green-50 px-2 py-0.5 rounded-full">Completed!</span>
                ) : (
                  <span className="text-secondary font-medium">Not completed yet</span>
                )}
              </p>
            </div>
            <div className="pt-4 border-t border-[var(--divider)] flex justify-between items-center">
              <span className="text-xs text-secondary font-semibold">{lessonsToday > 0 ? "1 / 1" : "0 / 1"} complete</span>
              <Link href={`/learn/curriculum/lesson/${nextLesson?.id || "N5"}`} className="btn-primary text-xs px-4 py-2 rounded-xl font-bold">
                Start Today&apos;s Lesson
              </Link>
            </div>
          </div>

          {/* Streak Freeze Shop */}
          <div className="bg-white border border-[var(--divider)] rounded-3xl p-6 shadow-sm flex flex-col justify-between min-h-[200px]">
            <div className="space-y-2">
              <h3 className="font-heading font-bold text-charcoal text-base">Streak Freeze</h3>
              <p className="text-secondary text-sm">Protect your streak if you miss a day. A freeze is consumed automatically.</p>
              <p className="text-charcoal text-xs font-semibold">
                You own: <span className="text-primary text-sm font-bold">{streakFreezes}</span> Freezes
              </p>
            </div>
            <div className="pt-4 border-t border-[var(--divider)] flex justify-between items-center">
              <span className="text-xs text-secondary font-semibold">Cost: 100 points (You have {points} pts)</span>
              <button
                type="button"
                onClick={handleBuyFreeze}
                disabled={purchasing || points < 100}
                className="btn-primary text-xs px-4 py-2 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {purchasing ? "Buying..." : points < 100 ? "Earn 100 pts" : "Buy Freeze"}
              </button>
            </div>
          </div>

        </div>

        {/* Section 6: Badges Showcase Preview */}
        <div className="bg-white border border-[var(--divider)] rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-[var(--divider)] pb-3">
            <h2 className="font-heading font-bold text-charcoal text-base">Recent Badges</h2>
            <Link href="/scoreboard" className="text-xs font-bold text-primary hover:underline">
              View all badges →
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {badges.length > 0 ? (
              badges.slice(0, 4).map((b) => (
                <div key={b.slug} className={`flex flex-col items-center justify-center border rounded-2xl p-4 text-center transition-all ${b.isEarned ? "bg-[#FFF7F7] border-primary/20 shadow-sm" : "bg-white border-[var(--divider)] opacity-60"}`}>
                  <span className="text-3xl mb-2" role="img" aria-label={b.name}>{b.iconEmoji || "🏆"}</span>
                  <h4 className="font-heading font-bold text-xs text-charcoal truncate w-full">{b.name}</h4>
                  {b.isEarned ? (
                    <span className="text-[10px] text-primary font-bold mt-1 bg-primary/10 px-2 py-0.5 rounded-full">Earned</span>
                  ) : (
                    <span className="text-[10px] text-secondary font-medium mt-1">🔒 Locked</span>
                  )}
                </div>
              ))
            ) : (
              <p className="text-secondary text-sm col-span-4 text-center py-6">
                No badges yet. Complete your first lesson to earn N5 Starter.
              </p>
            )}
          </div>
        </div>

        {/* Section 7: Activity Summary */}
        <div className="bg-[#FFF7F7] border border-primary/10 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-heading font-bold text-charcoal text-base">Today&apos;s Activity</h2>
            <button
              type="button"
              onClick={fetchAiSuggestions}
              disabled={aiLoading}
              className="text-primary text-xs font-bold hover:underline disabled:opacity-60"
            >
              {aiLoading ? "Analyzing..." : "Get AI Summary"}
            </button>
          </div>

          {aiSummary ? (
            <p className="text-charcoal text-sm italic bg-white/60 p-4 border border-[var(--divider)] rounded-2xl">&ldquo;{aiSummary}&rdquo;</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
              {[
                { label: "Lessons", value: lessonsToday },
                { label: "XP", value: lessonsToday * 10 },
                { label: "Points", value: lessonsToday * 5 },
                { label: "Reviews Due", value: stats.dueCount }
              ].map((act, i) => (
                <div key={i} className="bg-white p-3 rounded-2xl border border-[var(--divider)]">
                  <span className="text-secondary text-[11px] font-bold uppercase tracking-wider block">{act.label}</span>
                  <span className="font-heading font-black text-xl text-charcoal mt-1 block">{act.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 8: How Rewards Work (Collapsible) */}
        <div className="bg-white border border-[var(--divider)] rounded-3xl overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => setRewardsOpen(!rewardsOpen)}
            className="w-full text-left px-6 py-4 font-heading font-bold text-charcoal hover:bg-[var(--base)] transition flex justify-between items-center text-sm"
          >
            <span>💡 How rewards work</span>
            <span className="text-secondary">{rewardsOpen ? "▲" : "▼"}</span>
          </button>
          {rewardsOpen && (
            <div className="px-6 pb-6 pt-2 text-xs text-secondary space-y-2 border-t border-[var(--divider)] bg-[var(--base)]">
              <p>✓ <strong>Daily Login</strong>: 10 points each day you visit</p>
              <p>✓ <strong>Lesson Completed</strong>: 10 XP + 5 points</p>
              <p>✓ <strong>Practice Completed</strong>: 5 XP + 2 points</p>
              <p>✓ <strong>Quiz Completed</strong>: 20 XP + 10 points</p>
              <p>✓ <strong>Streak Milestones</strong>: Unlock badges (3-Day Spark, 7-Day Streak, etc.)</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
