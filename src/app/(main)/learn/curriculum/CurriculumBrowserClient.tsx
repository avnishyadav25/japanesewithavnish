"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

type Exercise = { id: string; content_slug: string; post_id: string | null; sort_order: number; title?: string | null };
type Lesson = {
  id: string;
  code: string;
  title: string;
  sort_order: number;
  estimated_minutes?: number;
  feature_image_url?: string;
  exercises: Exercise[];
};
type Submodule = { id: string; code: string; title: string; sort_order: number; feature_image_url?: string; lessons: Lesson[] };
type Module = { id: string; code: string; title: string; sort_order: number; feature_image_url?: string; submodules: Submodule[] };
type Level = { id: string; code: string; name: string; sort_order: number; feature_image_url?: string; modules: Module[] };

type CurriculumResponse = {
  levels: Level[];
  pathSteps?: unknown[];
  totalEstimatedMinutes?: number;
  pathProgressPercent?: number;
  currentLevelCode?: string;
  completedLessonIds?: string[];
  dueReviewsCount?: number;
  advanceBlocked?: boolean;
  advanceBlockReason?: string | null;
};

// Fallback visual cards matching /learn style
const MODULE_IMAGES = [
  "/images/hub/jlpt.jpg",
  "/images/hub/kana.jpg",
  "/images/hub/grammar.jpg",
  "/images/hub/vocabulary.jpg",
  "/images/hub/reading.jpg",
  "/images/hub/writing.jpg",
  "/images/hub/listening.jpg",
  "/images/hub/drills.jpg",
  "/images/hub/quiz.jpg",
];

export function CurriculumBrowserClient() {
  const [data, setData] = useState<CurriculumResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Active level selected tab
  const [activeLevel, setActiveLevel] = useState<string>("N5");
  // Active module detail modal overlay
  const [activeModule, setActiveModule] = useState<Module | null>(null);

  useEffect(() => {
    fetch("/api/learn/curriculum?path=1")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        if (d.currentLevelCode) {
          setActiveLevel(d.currentLevelCode.toUpperCase());
        }
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4" />
        <p className="text-secondary text-sm">Loading curriculum...</p>
      </div>
    );
  }

  if (!data?.levels?.length) {
    return (
      <p className="text-secondary text-center py-8">
        No curriculum modules seeded yet. Go to your{" "}
        <Link href="/learn/dashboard" className="text-primary hover:underline">dashboard</Link> to check your next lesson.
      </p>
    );
  }

  const levels = data.levels as Level[];
  const completedSet = new Set(data.completedLessonIds ?? []);

  // Filter levels
  const selectedLevel = levels.find((l) => l.code.toUpperCase() === activeLevel.toUpperCase());
  const modules = selectedLevel ? selectedLevel.modules : [];

  return (
    <div className="space-y-8">
      {/* Level Selection Tabs */}
      <div className="flex justify-center sm:justify-start gap-2 border-b border-[var(--divider)] pb-4 overflow-x-auto">
        {levels.map((lvl) => (
          <button
            key={lvl.id}
            type="button"
            onClick={() => setActiveLevel(lvl.code.toUpperCase())}
            className={`px-6 py-2.5 rounded-full text-sm font-semibold border transition duration-200 whitespace-nowrap ${
              activeLevel.toUpperCase() === lvl.code.toUpperCase()
                ? "bg-primary border-primary text-white shadow-sm"
                : "bg-white border-[var(--divider)] text-[#555] hover:border-primary hover:text-primary"
            }`}
          >
            {lvl.code} Course
          </button>
        ))}
      </div>

      {/* Grid of Module Cards */}
      {modules.length === 0 ? (
        <div className="text-center py-12 text-secondary">
          No modules found for level {activeLevel} in the curriculum database.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {modules.map((mod, idx) => {
            const modLessons = mod.submodules.flatMap((s) => s.lessons);
            const modCompletedCount = modLessons.filter((l) => completedSet.has(l.id)).length;
            const modTotal = modLessons.length;
            const modPercent = modTotal > 0 ? Math.round((modCompletedCount / modTotal) * 100) : 0;
            const imgUrl = mod.feature_image_url || MODULE_IMAGES[idx % MODULE_IMAGES.length];

            return (
              <div
                key={mod.id}
                onClick={() => setActiveModule(mod)}
                className="group flex flex-col bg-white rounded-2xl overflow-hidden border border-[#E2E8F0] hover:border-primary hover:shadow-md transition-all duration-300 cursor-pointer"
              >
                {/* Visual Cover */}
                <div className="relative aspect-[4/3] w-full bg-[#FAF8F5] overflow-hidden border-b border-[#E2E8F0]">
                  <Image
                    src={imgUrl}
                    alt={mod.title}
                    fill
                    sizes="(max-w-768px) 100vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    unoptimized
                  />
                  <span className="absolute top-3 left-3 px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded-full bg-charcoal/95 text-white select-none">
                    Module {mod.code}
                  </span>
                </div>

                {/* Info & Progress */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-heading text-base font-bold text-[#1A1A1A] group-hover:text-primary transition-colors mb-2 line-clamp-2">
                      {mod.title}
                    </h3>
                    <p className="text-secondary text-xs">
                      {mod.submodules.length} submodules · {modTotal} lessons
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-secondary mb-1">
                      <span>Progress</span>
                      <span className="font-semibold text-charcoal">{modPercent}%</span>
                    </div>
                    <div className="h-2 w-full bg-[var(--divider)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${modPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Module Drill-down Modal */}
      {activeModule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/40 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-[var(--base)] rounded-2xl shadow-xl border border-[var(--divider)] overflow-hidden flex flex-col my-8">
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--divider)] bg-white sticky top-0 z-10">
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-primary">
                  {activeLevel} — Module {activeModule.code}
                </span>
                <h3 className="font-heading text-lg font-bold text-charcoal mt-0.5">
                  {activeModule.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModule(null)}
                className="text-secondary hover:text-charcoal p-1.5 rounded-full hover:bg-[var(--divider)]/40 transition"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable details */}
            <div className="overflow-y-auto max-h-[70vh] p-6 space-y-6">
              {activeModule.submodules.length === 0 ? (
                <p className="text-secondary text-sm text-center py-6">
                  No submodules seeded yet for this module.
                </p>
              ) : (
                activeModule.submodules.map((sub) => (
                  <div key={sub.id} className="bg-white p-5 rounded-2xl border border-[var(--divider)] shadow-xs">
                    <h4 className="font-heading text-sm font-bold text-charcoal mb-4 border-b border-[var(--divider)]/40 pb-2">
                      Submodule {sub.code} — {sub.title}
                    </h4>

                    {/* Lessons list */}
                    {sub.lessons.length === 0 ? (
                      <p className="text-xs text-secondary italic">No lessons in this submodule yet.</p>
                    ) : (
                      <div className="space-y-4">
                        {sub.lessons.map((les) => {
                          const completed = completedSet.has(les.id);
                          return (
                            <div
                              key={les.id}
                              className="p-3.5 rounded-xl border border-[var(--divider)]/60 bg-[#FAF8F5] flex flex-col md:flex-row md:items-center justify-between gap-4"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  {completed ? (
                                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-600 text-xs font-bold shrink-0">
                                      ✓
                                    </span>
                                  ) : (
                                    <span className="w-5 h-5 rounded-full border-2 border-gray-300 shrink-0" />
                                  )}
                                  <span className="text-xs font-mono font-bold text-secondary">
                                    LESSON {les.code}
                                  </span>
                                  {les.estimated_minutes && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-charcoal/5 text-secondary font-medium">
                                      ⏱ {les.estimated_minutes} min
                                    </span>
                                  )}
                                </div>
                                <h5 className="font-heading text-sm font-bold text-charcoal truncate">
                                  {les.title}
                                </h5>

                                {/* Practices / Exercises */}
                                {les.exercises && les.exercises.length > 0 && (
                                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                                    {les.exercises.map((ex) => (
                                      <Link
                                        key={ex.id}
                                        href={`/learn/curriculum/lesson/${les.id}`}
                                        onClick={() => setActiveModule(null)}
                                        className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition"
                                      >
                                        🎯 {ex.title || `Practice Drill`}
                                      </Link>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <Link
                                href={`/learn/curriculum/lesson/${les.id}`}
                                onClick={() => setActiveModule(null)}
                                className="px-4 py-2 bg-primary hover:bg-primary/95 text-white text-xs font-bold rounded-xl transition duration-150 text-center shadow-xs shrink-0"
                              >
                                Study Lesson
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[var(--divider)] bg-white flex justify-end sticky bottom-0 z-10">
              <button
                type="button"
                onClick={() => setActiveModule(null)}
                className="px-5 py-2 bg-charcoal text-white rounded-bento text-sm font-semibold hover:bg-charcoal/90 transition shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
