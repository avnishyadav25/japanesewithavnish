"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { LockedModulePrompt } from "@/components/learn/LockedModulePrompt";

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
  isLoggedIn?: boolean;
};

// Topic-based module cover mapping helper
function getModuleImage(level: string, code: string, title: string): string {
  const t = title.toLowerCase();
  if (t.includes("writing") || t.includes("kana") || t.includes("hiragana") || t.includes("katakana")) {
    return "/images/hub/kana.jpg";
  }
  if (t.includes("kanji")) {
    return "/images/hub/kanji.jpg";
  }
  if (
    t.includes("grammar") ||
    t.includes("particle") ||
    t.includes("mechanics") ||
    t.includes(" て ") ||
    t.includes("casual") ||
    t.includes("form")
  ) {
    return "/images/hub/grammar.jpg";
  }
  if (t.includes("vocab") || t.includes("daily life") || t.includes("greetings") || t.includes("introduction")) {
    return "/images/hub/vocabulary.jpg";
  }
  if (t.includes("listening") || t.includes("comprehension") || t.includes("audio")) {
    return "/images/hub/listening.jpg";
  }
  if (t.includes("reading") || t.includes("sandbox") || t.includes("passage")) {
    return "/images/hub/reading.jpg";
  }
  if (t.includes("writing") || t.includes("composition") || t.includes("trace")) {
    return "/images/hub/writing.jpg";
  }
  if (t.includes("drill") || t.includes("practice") || t.includes("exercise")) {
    return "/images/hub/drills.jpg";
  }

  // Curated fallbacks by module code
  const fallbacks = [
    "/images/hub/jlpt.jpg",
    "/images/hub/drills.jpg",
    "/images/hub/quiz.jpg",
    "/images/hub/grammar.jpg",
  ];
  const charCodeSum = code.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return fallbacks[charCodeSum % fallbacks.length];
}

// Authentication Access Gate check
function isModuleLocked(levelCode: string, moduleCode: string, isLoggedIn: boolean): boolean {
  if (isLoggedIn) return false;
  // Guest user: N5 Modules 1, 2, and M1 are open/unlocked
  if (levelCode.toUpperCase() === "N5") {
    return !["1", "2", "M1"].includes(moduleCode);
  }
  // All other N4-N1 modules are locked for guest users
  return true;
}

function formatTotalTime(minutes: number): string {
  if (minutes < 60) return `~${minutes} min`;
  const hrs = Math.round(minutes / 60);
  return `~${hrs} hr${hrs !== 1 ? "s" : ""}`;
}

export function CurriculumBrowserClient() {
  const [data, setData] = useState<CurriculumResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Selected level tab
  const [activeLevel, setActiveLevel] = useState<string>("N5");
  // Lock modal state
  const [showLockModal, setShowLockModal] = useState(false);

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
        <p className="text-secondary text-sm">Loading curriculum path...</p>
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
  const progressPercent = data.pathProgressPercent ?? 0;
  const totalMinutes = data.totalEstimatedMinutes ?? 0;
  const completedSet = new Set(data.completedLessonIds ?? []);
  const isLoggedIn = data.isLoggedIn ?? false;

  // Filter modules
  const selectedLevel = levels.find((l) => l.code.toUpperCase() === activeLevel.toUpperCase());
  const modules = selectedLevel ? selectedLevel.modules : [];

  return (
    <div className="space-y-8">
      {/* Path progress bar (top only) */}
      <div className="rounded-2xl border border-[var(--divider)] bg-white p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex-1 min-w-0">
          <h2 className="font-heading text-lg font-bold text-charcoal">Course Study Path</h2>
          <p className="text-secondary text-xs mt-0.5">
            {progressPercent}% overall complete
            {totalMinutes > 0 && <span className="ml-1.5"> · {formatTotalTime(totalMinutes)} total study time</span>}
          </p>
          <div className="mt-3 h-2.5 bg-[var(--divider)] rounded-full overflow-hidden max-w-md">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, progressPercent)}%` }}
            />
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-[#FAF8F5] rounded-xl border border-[var(--divider)]">
          <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-semibold text-charcoal">
            {isLoggedIn ? "Premium Path Active" : "Guest Mode (Limited)"}
          </span>
        </div>
      </div>

      {/* Level Selection Tab Bar */}
      <div className="flex gap-2 border-b border-[var(--divider)] pb-4 overflow-x-auto scrollbar-none">
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

      {/* Vertical Timeline Path */}
      {modules.length === 0 ? (
        <div className="text-center py-12 text-secondary">
          No modules found for level {activeLevel} in the curriculum database.
        </div>
      ) : (
        <div className="space-y-12 relative pl-4 sm:pl-0">
          {modules.map((mod, idx) => {
            const modLessons = mod.submodules.flatMap((s) => s.lessons);
            const modCompletedCount = modLessons.filter((l) => completedSet.has(l.id)).length;
            const modTotal = modLessons.length;
            const modPercent = modTotal > 0 ? Math.round((modCompletedCount / modTotal) * 100) : 0;
            
            const isLocked = isModuleLocked(activeLevel, mod.code, isLoggedIn);
            const imgUrl = getModuleImage(activeLevel, mod.code, mod.title);

            return (
              <div
                key={mod.id}
                className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
              >
                {/* SVG Animated Connector Line (Desktop only) */}
                {idx < modules.length - 1 && (
                  <div
                    className="absolute left-[130px] top-[200px] bottom-[-48px] w-1 bg-[var(--divider)] hidden lg:block"
                    aria-hidden
                  >
                    <div
                      className="h-full bg-primary transition-all duration-1000 origin-top animate-pulse"
                      style={{
                        transform: `scaleY(${modCompletedCount > 0 ? 1 : 0})`,
                        transitionDelay: `${idx * 150}ms`,
                      }}
                    />
                  </div>
                )}

                {/* Left: Module Card Node */}
                <div className="lg:col-span-4 relative z-10">
                  <div
                    className={`group flex flex-col bg-white rounded-2xl overflow-hidden border transition-all duration-300 ${
                      isLocked
                        ? "border-[var(--divider)] opacity-85 hover:opacity-100"
                        : "border-[#E2E8F0] hover:border-primary hover:shadow-md"
                    }`}
                  >
                    {/* Visual Cover */}
                    <div className="relative aspect-[16/10] w-full bg-[#FAF8F5] overflow-hidden border-b border-[#E2E8F0]">
                      <Image
                        src={imgUrl}
                        alt={mod.title}
                        fill
                        sizes="(max-w-768px) 100vw, 30vw"
                        className="object-cover group-hover:scale-102 transition-transform duration-500"
                        unoptimized
                      />

                      {/* Lock Watermark Overlay */}
                      {isLocked ? (
                        <div
                          onClick={() => setShowLockModal(true)}
                          className="absolute inset-0 bg-charcoal/40 backdrop-blur-xs flex items-center justify-center cursor-pointer"
                        >
                          <div className="bg-white/95 px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-bold text-charcoal shadow-sm">
                            <span className="text-xs">🔒</span> Premium
                          </div>
                        </div>
                      ) : (
                        <span className="absolute top-3 left-3 px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider rounded-full bg-charcoal/95 text-white select-none">
                          Module {mod.code}
                        </span>
                      )}
                    </div>

                    {/* Info details */}
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-heading text-base font-bold text-charcoal group-hover:text-primary transition-colors mb-2 block">
                          {mod.title}
                        </h3>
                        <p className="text-secondary text-xs">
                          {mod.submodules.length} submodules · {modTotal} lessons
                        </p>
                      </div>

                      {/* Card progress */}
                      {!isLocked && (
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-[10px] text-secondary mb-1">
                            <span>Module Progress</span>
                            <span className="font-semibold text-charcoal">{modPercent}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-[var(--divider)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all duration-300"
                              style={{ width: `${modPercent}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Submodules & Lessons list (inline) */}
                <div
                  className={`lg:col-span-8 bg-white rounded-2xl border border-[var(--divider)] p-6 space-y-6 shadow-xs relative ${
                    isLocked ? "bg-gray-50/50" : ""
                  }`}
                >
                  {isLocked && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-white/20 backdrop-blur-xs rounded-2xl">
                      <div className="bg-white/95 border border-[var(--divider)] rounded-2xl p-5 text-center max-w-sm shadow-md animate-scaleUp">
                        <span className="text-2xl mb-2 block">🔒</span>
                        <h4 className="font-heading text-sm font-bold text-charcoal mb-1">
                          Premium Study Module
                        </h4>
                        <p className="text-secondary text-xs mb-4">
                          Sign in or register a free account to unlock this module and study these lessons.
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowLockModal(true)}
                          className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/95 transition shadow-sm"
                        >
                          Unlock Module
                        </button>
                      </div>
                    </div>
                  )}

                  <div className={`space-y-6 ${isLocked ? "blur-[2px] opacity-40 select-none pointer-events-none" : ""}`}>
                    {mod.submodules.length === 0 ? (
                      <p className="text-secondary text-xs italic">No lessons seeded in this module yet.</p>
                    ) : (
                      mod.submodules.map((sub) => (
                        <div key={sub.id} className="space-y-3">
                          <h4 className="font-heading text-sm font-bold text-charcoal/80 border-b border-[var(--divider)]/45 pb-1">
                            Submodule {sub.code} — {sub.title}
                          </h4>

                          {/* Submodule lessons */}
                          <div className="space-y-3">
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

                                    {/* Direct practices / exercises links */}
                                    {les.exercises && les.exercises.length > 0 && (
                                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                                        {les.exercises.map((ex) => (
                                          <Link
                                            key={ex.id}
                                            href={`/learn/curriculum/lesson/${les.id}`}
                                            className="px-2.5 py-0.5 text-[10px] font-semibold rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition"
                                          >
                                            🎯 {ex.title || `Practice`}
                                          </Link>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  <Link
                                    href={`/learn/curriculum/lesson/${les.id}`}
                                    className="px-4 py-2 bg-primary hover:bg-primary/95 text-white text-xs font-bold rounded-xl transition duration-150 text-center shadow-xs shrink-0"
                                  >
                                    Study Lesson
                                  </Link>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Access Gate Prompt Modal */}
      <LockedModulePrompt isOpen={showLockModal} onClose={() => setShowLockModal(false)} />
    </div>
  );
}
