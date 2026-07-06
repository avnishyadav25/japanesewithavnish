"use client";

import { useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";

export function XPRulesForm({ initial }: { initial: Record<string, string> }) {
  const [lessonXp, setLessonXp] = useState(initial.xp_lesson_completed || "10");
  const [practiceXp, setPracticeXp] = useState(initial.xp_practice_completed || "5");
  const [quizXp, setQuizXp] = useState(initial.xp_quiz_passed || "15");
  const [streakXp, setStreakXp] = useState(initial.xp_daily_streak || "20");
  const [multiplier, setMultiplier] = useState(initial.points_multiplier || "1");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");

    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          xp_lesson_completed: Number(lessonXp),
          xp_practice_completed: Number(practiceXp),
          xp_quiz_passed: Number(quizXp),
          xp_daily_streak: Number(streakXp),
          points_multiplier: Number(multiplier),
        }),
      });

      if (!res.ok) throw new Error("Failed to save rules");
      setMsg("✅ Gamification rules updated successfully!");
    } catch (err: any) {
      setMsg(`❌ Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {msg && (
        <div className="p-4 bg-white border border-[var(--divider)] rounded-2xl text-xs font-semibold shadow-sm">
          {msg}
        </div>
      )}

      <AdminCard>
        <h3 className="font-heading font-bold text-charcoal text-sm mb-4">Event XP Awards</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase text-secondary mb-1">XP per Lesson Completed</label>
            <input
              type="number"
              min="0"
              required
              value={lessonXp}
              onChange={(e) => setLessonXp(e.target.value)}
              className="w-full h-10 px-3 border border-[var(--divider)] rounded-xl text-xs text-charcoal focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-secondary mb-1">XP per Practice Completed</label>
            <input
              type="number"
              min="0"
              required
              value={practiceXp}
              onChange={(e) => setPracticeXp(e.target.value)}
              className="w-full h-10 px-3 border border-[var(--divider)] rounded-xl text-xs text-charcoal focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-secondary mb-1">XP per Quiz Passed</label>
            <input
              type="number"
              min="0"
              required
              value={quizXp}
              onChange={(e) => setQuizXp(e.target.value)}
              className="w-full h-10 px-3 border border-[var(--divider)] rounded-xl text-xs text-charcoal focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-secondary mb-1">XP per Daily Streak Maintained</label>
            <input
              type="number"
              min="0"
              required
              value={streakXp}
              onChange={(e) => setStreakXp(e.target.value)}
              className="w-full h-10 px-3 border border-[var(--divider)] rounded-xl text-xs text-charcoal focus:outline-none"
            />
          </div>
        </div>
      </AdminCard>

      <AdminCard>
        <h3 className="font-heading font-bold text-charcoal text-sm mb-4">Points Conversion Multiplier</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase text-secondary mb-1">XP to Points Multiplier Ratio</label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              required
              value={multiplier}
              onChange={(e) => setMultiplier(e.target.value)}
              className="w-full h-10 px-3 border border-[var(--divider)] rounded-xl text-xs text-charcoal focus:outline-none"
            />
            <span className="text-[10px] text-secondary mt-1 block">Points earned = XP earned * Multiplier ratio. For example: 10 XP * 1 = 10 Points.</span>
          </div>
        </div>
      </AdminCard>

      <button
        type="submit"
        disabled={saving}
        className="w-full btn-primary h-11 rounded-xl text-xs font-bold font-heading"
      >
        {saving ? "Saving Rules..." : "Save Gamification Rules"}
      </button>
    </form>
  );
}
