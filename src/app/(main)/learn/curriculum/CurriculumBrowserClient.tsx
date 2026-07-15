"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { LockedModulePrompt } from "@/components/learn/LockedModulePrompt";
import { Countdown } from "@/components/learn/Countdown";

type Practice = { id: string; title: string; description: string | null; practice_type: string | null; sort_order: number; estimated_minutes?: number };
type Exercise = { id: string; content_slug: string; post_id: string | null; sort_order: number; title?: string | null };
type Lesson = {
  id: string;
  slug: string;
  code: string;
  title: string;
  description?: string | null;
  access_type?: string;
  content_type?: string | null;
  sort_order: number;
  estimated_minutes?: number;
  feature_image_url?: string;
  exercises: Exercise[];
  practices?: Practice[];
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
  isPremium?: boolean;
  lessonsConsumed?: number;
  lessonsAllowed?: number;
  resetAt?: string;
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

// DB-driven module lock: locked if ALL lessons have access_type = 'premium' and user is not logged in
function isModuleLocked(mod: Module, isLoggedIn: boolean): boolean {
  if (isLoggedIn) return false;
  const allLessons = mod.submodules.flatMap((s) => s.lessons);
  if (allLessons.length === 0) return false;
  return allLessons.every((l) => (l.access_type ?? "premium") === "premium");
}

// Content type display config
const CONTENT_TYPE_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  orientation:   { label: "Orientation",   color: "#0EA5E9", emoji: "🧭" },
  pronunciation: { label: "Pronunciation", color: "#F59E0B", emoji: "🔊" },
  grammar:      { label: "Grammar",      color: "#4F46E5", emoji: "📖" },
  vocabulary:   { label: "Vocabulary",   color: "#0891B2", emoji: "📝" },
  kanji:        { label: "Kanji",        color: "#7C3AED", emoji: "漢" },
  kana:         { label: "Kana",         color: "#DB2777", emoji: "あ" },
  reading:      { label: "Reading",      color: "#059669", emoji: "📰" },
  listening:    { label: "Listening",    color: "#D97706", emoji: "👂" },
  writing:      { label: "Writing",      color: "#0D9488", emoji: "✍️" },
  speaking:     { label: "Speaking",     color: "#E11D48", emoji: "🗣️" },
  conversation: { label: "Conversation", color: "#65A30D", emoji: "💬" },
  culture:      { label: "Culture",      color: "#B45309", emoji: "🎎" },
  strategy:     { label: "Strategy",     color: "#0F766E", emoji: "🎯" },
  review:       { label: "Review",       color: "#6366F1", emoji: "🔄" },
  mock_test:    { label: "Mock Test",    color: "#DC2626", emoji: "📋" },
  mixed:        { label: "Mixed",        color: "#78716C", emoji: "🧩" },
};

const PRACTICE_TYPE_CONFIG: Record<string, { label: string; emoji: string }> = {
  writing_canvas:   { label: "Writing",    emoji: "✍️" },
  mcq:              { label: "Quiz",       emoji: "❓" },
  fill_blank:       { label: "Fill-in",    emoji: "✏️" },
  roleplay:         { label: "Roleplay",   emoji: "💬" },
  listening:        { label: "Listening",  emoji: "🎧" },
  shadowing:        { label: "Shadowing",  emoji: "🔊" },
  module_checkpoint: { label: "Checkpoint",     emoji: "🚩" },
  level_assessment:  { label: "Level Assessment", emoji: "🏆" },
};

function formatTotalTime(minutes: number): string {
  if (minutes < 60) return `~${minutes} min`;
  const hrs = Math.round(minutes / 60);
  return `~${hrs} hr${hrs !== 1 ? "s" : ""}`;
}

export function CurriculumBrowserClient({ initialData }: { initialData: CurriculumResponse }) {
  const [data] = useState<CurriculumResponse | null>(initialData);

  const searchParams = useSearchParams();
  const levelParam = searchParams ? searchParams.get("level") : null;
  const moduleParam = searchParams ? searchParams.get("module") : null;

  // Selected level tab
  const [activeLevel, setActiveLevel] = useState<string>(
    (levelParam || initialData.currentLevelCode || "N5").toUpperCase()
  );
  // Active module selection (defaults to first module of active level)
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  // Lock modal state
  const [showLockModal, setShowLockModal] = useState(false);

  // Helper to sync URL search parameters
  const updateUrlParams = (level: string, moduleId: string | null) => {
    const params = new URLSearchParams(window.location.search);
    params.set("level", level);
    if (moduleId) {
      params.set("module", moduleId);
    } else {
      params.delete("module");
    }
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  };

  const levels = (data?.levels as Level[]) || [];
  const selectedLevel = levels.find((l) => l.code.toUpperCase() === activeLevel.toUpperCase());
  const modules = selectedLevel ? selectedLevel.modules : [];

  // Reset active module when level tab changes
  useEffect(() => {
    if (modules.length > 0) {
      if (moduleParam) {
        const found = modules.find((m) => m.id === moduleParam);
        if (found) {
          setActiveModuleId(found.id);
          return;
        }
      }
      setActiveModuleId(modules[0].id);
    } else {
      setActiveModuleId(null);
    }
  }, [activeLevel, data, modules.length, moduleParam]);

  if (!data?.levels?.length) {
    return (
      <p className="text-secondary text-center py-8">
        No curriculum modules seeded yet. Go to your{" "}
        <Link href="/learn/dashboard" className="text-primary hover:underline">dashboard</Link> to check your next lesson.
      </p>
    );
  }

  const progressPercent = data.pathProgressPercent ?? 0;
  const totalMinutes = data.totalEstimatedMinutes ?? 0;
  const completedSet = new Set(data.completedLessonIds ?? []);
  const isLoggedIn = data.isLoggedIn ?? false;
  const isPremium = data.isPremium ?? false;
  const lessonsConsumed = data.lessonsConsumed ?? 0;
  const lessonsAllowed = data.lessonsAllowed ?? 2;
  const resetAt = data.resetAt ?? "";

  // Find next incomplete lesson for active level
  const activeLevelIncompleteLesson = data.pathSteps?.find(
    (step: any) =>
      step.type === "lesson" &&
      !completedSet.has(step.id) &&
      step.levelCode.toUpperCase() === activeLevel.toUpperCase()
  ) as any;

  return (
    <div className="space-y-8 max-w-[1100px] mx-auto">
      {/* Path progress bar (top only) */}
      <div className="rounded-2xl border border-[var(--divider)] bg-white p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
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
        <div className="flex flex-wrap items-center gap-3">
          {activeLevelIncompleteLesson && (
            <Link
              href={`/learn/curriculum/lesson/${activeLevelIncompleteLesson.slug || activeLevelIncompleteLesson.id}`}
              className="px-4 py-2 bg-primary hover:bg-primary/95 text-white text-xs font-bold rounded-xl transition duration-150 shadow-sm whitespace-nowrap"
            >
              Continue: {activeLevelIncompleteLesson.title} →
            </Link>
          )}
          {isLoggedIn ? (
            isPremium ? (
              <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-green-50 rounded-xl border border-green-200">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-xs font-bold text-green-700">✨ Premium Active</span>
              </div>
            ) : (
              <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-yellow-50 rounded-xl border border-yellow-200">
                <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                <span className="text-xs font-bold text-yellow-700">
                  Free Tier ({lessonsConsumed}/{lessonsAllowed} today)
                </span>
              </div>
            )
          ) : (
            <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-[#FAF8F5] rounded-xl border border-[var(--divider)]">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              <span className="text-xs font-semibold text-charcoal">Guest Mode</span>
            </div>
          )}
        </div>
      </div>

      {/* Daily Free Limit Reached Alert Banner */}
      {!isPremium && isLoggedIn && lessonsConsumed >= lessonsAllowed && (
        <div className="bg-[#FFF9F6] border border-[#FFD2C2] rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm animate-pulse">
          <div className="space-y-1 text-center md:text-left">
            <h4 className="font-heading text-sm font-bold text-charcoal flex items-center justify-center md:justify-start gap-2">
              <span className="text-base">🔒</span> Daily Free Lesson Limit Reached
            </h4>
            <p className="text-secondary text-xs">
              You have completed your {lessonsAllowed} free lessons for today. Next lesson resets at midnight.
            </p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            {resetAt && (
              <div className="text-right hidden md:block">
                <p className="text-[10px] text-secondary uppercase tracking-wider font-bold">Unlocks In</p>
                <Countdown resetAt={resetAt} />
              </div>
            )}
            <Link
              href="/pricing"
              className="px-5 py-2.5 bg-[#D0021B] hover:bg-[#D0021B]/95 text-white text-xs font-bold rounded-xl transition duration-150 shadow-md block text-center"
            >
              Get Premium Access Pass
            </Link>
          </div>
        </div>
      )}

      {/* Level Selection Tab Bar */}
      <div className="flex gap-2 border-b border-[var(--divider)] pb-4 overflow-x-auto scrollbar-none">
        {levels.map((lvl) => {
          const isActive = activeLevel.toUpperCase() === lvl.code.toUpperCase();
          return (
            <button
              key={lvl.id}
              type="button"
              onClick={() => {
                const newLevel = lvl.code.toUpperCase();
                setActiveLevel(newLevel);
                const newSelectedLevel = levels.find((l) => l.code.toUpperCase() === newLevel);
                const newModules = newSelectedLevel ? newSelectedLevel.modules : [];
                const newModId = newModules.length > 0 ? newModules[0].id : null;
                updateUrlParams(newLevel, newModId);
              }}
              className={`px-6 py-2.5 rounded-full text-sm font-semibold border transition duration-200 whitespace-nowrap ${
                isActive
                  ? "bg-[#D0021B] border-[#D0021B] text-white shadow-sm"
                  : "bg-white border-[#E6E6E6] text-[#555] hover:border-[#D0021B] hover:text-[#D0021B]"
              }`}
            >
              {lvl.code} Course
            </button>
          );
        })}
      </div>

      {/* 2-Column Modules Selector layout */}
      {modules.length === 0 ? (
        <div className="text-center py-12 text-secondary">
          No modules found for level {activeLevel} in the curriculum database.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Module Card Navigation — first on mobile for easy picking, right column on desktop */}
          <div className="order-1 lg:order-1 lg:col-span-4 space-y-4">
            <h3 className="font-heading text-sm font-bold text-secondary uppercase tracking-wider mb-2 pl-1">
              Modules
            </h3>
            <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 scrollbar-none">
              {modules.map((mod) => {
                const modLessons = mod.submodules.flatMap((s) => s.lessons);
                const modCompletedCount = modLessons.filter((l) => completedSet.has(l.id)).length;
                const modTotal = modLessons.length;
                const modPercent = modTotal > 0 ? Math.round((modCompletedCount / modTotal) * 100) : 0;
                
                const isLocked = isModuleLocked(mod, isLoggedIn);
                const imgUrl = getModuleImage(activeLevel, mod.code, mod.title);
                const isActive = mod.id === activeModuleId;

                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => {
                      if (isLocked) {
                        setShowLockModal(true);
                      } else {
                        setActiveModuleId(mod.id);
                        updateUrlParams(activeLevel, mod.id);
                      }
                    }}
                    className={`w-[280px] lg:w-full text-left shrink-0 bg-white rounded-2xl border transition-all duration-200 overflow-hidden flex flex-row items-stretch ${
                      isActive
                        ? "border-[#D0021B] shadow-sm ring-1 ring-[#D0021B]/20"
                        : "border-[var(--divider)] hover:border-primary/50"
                    } ${isLocked ? "opacity-75" : ""}`}
                  >
                    {/* Small image cover (height 140px on left) */}
                    <div className="relative w-24 shrink-0 bg-[#FAF8F5] border-r border-[var(--divider)]">
                      <Image
                        src={imgUrl}
                        alt={mod.title}
                        fill
                        sizes="100px"
                        className="object-cover"
                        unoptimized
                      />
                      {isLocked && (
                        <div className="absolute inset-0 bg-charcoal/40 flex items-center justify-center">
                          <span className="text-sm">🔒</span>
                        </div>
                      )}
                    </div>
                    {/* Details content */}
                    <div className="p-3 flex-1 flex flex-col justify-between min-w-0">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-secondary tracking-wider">
                          Module {mod.code}
                        </span>
                        <h4 className="font-heading text-xs font-bold text-charcoal line-clamp-2 mt-0.5">
                          {mod.title}
                        </h4>
                      </div>
                      {!isLocked && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-[8px] text-secondary mb-0.5">
                            <span>{modPercent}% complete</span>
                          </div>
                          <div className="h-1 w-full bg-[var(--divider)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all duration-300"
                              style={{ width: `${modPercent}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Module Content: submodule path + lessons — second on mobile, left column on desktop */}
          <div className="order-2 lg:order-2 lg:col-span-8 bg-white rounded-2xl border border-[var(--divider)] p-6 shadow-sm">
            {(() => {
              const activeMod = modules.find((m) => m.id === activeModuleId) || modules[0];
              if (!activeMod) {
                return (
                  <p className="text-secondary text-sm italic">
                    Select a module to start.
                  </p>
                );
              }
              const isLocked = isModuleLocked(activeMod, isLoggedIn);
              const activeModIndex = modules.findIndex((m) => m.id === activeMod.id);
              const nextMod = activeModIndex >= 0 ? modules[activeModIndex + 1] : undefined;

              return (
                <div className="relative">
                  {isLocked && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-white/40 backdrop-blur-xs rounded-2xl">
                      <div className="bg-white border border-[var(--divider)] rounded-2xl p-5 text-center max-w-sm shadow-md animate-scaleUp">
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
                    <div className="pb-3 border-b border-[var(--divider)]">
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                        Module {activeMod.code} Curriculum
                      </span>
                      <h3 className="font-heading text-base font-bold text-charcoal mt-0.5">
                        {activeMod.title}
                      </h3>
                    </div>

                    {activeMod.submodules.length === 0 ? (
                      <p className="text-secondary text-xs italic">No lessons seeded in this module yet.</p>
                    ) : (
                      <div>
                        {activeMod.submodules.map((sub, subIdx) => {
                          const isLastSubmodule = subIdx === activeMod.submodules.length - 1;
                          const subLessonIds = sub.lessons.map((l) => l.id);
                          const subCompleted = subLessonIds.length > 0 && subLessonIds.every((id) => completedSet.has(id));
                          return (
                            <div key={sub.id} className="flex items-stretch gap-3">
                              {/* Tree rail: submodule node + connecting line down to the next block */}
                              <div className="flex flex-col items-center shrink-0 w-8">
                                <span
                                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[11px] font-bold shrink-0 ${
                                    subCompleted
                                      ? "bg-green-500 border-green-500 text-white"
                                      : "bg-white border-[#D0021B]/60 text-[#D0021B]"
                                  }`}
                                >
                                  {subCompleted ? "✓" : sub.code}
                                </span>
                                {!isLastSubmodule && <div className="w-0.5 flex-1 bg-[var(--divider)] my-1" />}
                              </div>

                              {/* Submodule block */}
                              <div className={`flex-1 min-w-0 rounded-2xl border border-[var(--divider)] bg-[#FAF8F5]/50 p-4 ${isLastSubmodule ? "mb-0" : "mb-4"}`}>
                                <h4 className="font-heading text-xs font-bold text-charcoal/80 mb-3">
                                  Submodule {sub.code} — {sub.title}
                                </h4>

                                {/* Submodule lessons, chained as a mini path */}
                                <div>
                                  {sub.lessons.map((les, lesIdx) => {
                                    const completed = completedSet.has(les.id);
                                    const ctCfg = CONTENT_TYPE_CONFIG[les.content_type ?? ""];
                                    const isFreeLesson = (les.access_type ?? "premium") === "free";
                                    const isInProgress = activeLevelIncompleteLesson?.id === les.id;
                                    const isLastLesson = lesIdx === sub.lessons.length - 1;

                                    return (
                                      <div key={les.id} className="flex items-stretch gap-2.5">
                                        {/* Lesson node + connector */}
                                        <div className="flex flex-col items-center shrink-0 w-5">
                                          {completed ? (
                                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-green-500 text-white text-[10px] font-bold shrink-0 shadow-xs" title="Completed">
                                              ✓
                                            </span>
                                          ) : isInProgress ? (
                                            <span className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-dashed border-[#D0021B] text-[9px] text-[#D0021B] font-bold shrink-0 animate-pulse" title="In Progress">
                                              ●
                                            </span>
                                          ) : (
                                            <span className="w-5 h-5 rounded-full border-2 border-gray-300 shrink-0" title="Not Started" />
                                          )}
                                          {!isLastLesson && <div className="w-0.5 flex-1 bg-[var(--divider)]/70 my-0.5" />}
                                        </div>

                                        <div className={`flex-1 min-w-0 p-3 rounded-xl border bg-white flex flex-col gap-3 transition duration-200 ${isLastLesson ? "mb-0" : "mb-2.5"} ${
                                          isInProgress
                                            ? "border-[#D0021B] shadow-xs ring-1 ring-[#D0021B]/10"
                                            : "border-[var(--divider)]/60"
                                        }`}
                                        >
                                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                            <div className="flex-1 min-w-0">
                                              {/* Tags */}
                                              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                                <span className="text-[10px] font-mono font-bold text-secondary">
                                                  LESSON {les.code}
                                                </span>
                                                {les.estimated_minutes && (
                                                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-charcoal/5 text-secondary font-medium">
                                                    ⏱ {les.estimated_minutes} min
                                                  </span>
                                                )}
                                                {ctCfg && (
                                                  <span
                                                    className="text-[9px] px-2 py-0.5 rounded-full font-semibold border"
                                                    style={{ color: ctCfg.color, borderColor: ctCfg.color + "33", backgroundColor: ctCfg.color + "11" }}
                                                  >
                                                    {ctCfg.emoji} {ctCfg.label}
                                                  </span>
                                                )}
                                                {isFreeLesson ? (
                                                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-semibold">🆓 Free</span>
                                                ) : (
                                                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">🔒 Premium</span>
                                                )}
                                              </div>

                                              {/* Bold Title */}
                                              <h5 className="font-heading text-sm font-bold text-charcoal">
                                                {les.title}
                                              </h5>

                                              {/* Small description */}
                                              {les.description && (
                                                <p className="text-[11px] text-secondary mt-1 leading-relaxed line-clamp-2">
                                                  {les.description}
                                                </p>
                                              )}
                                            </div>

                                            <Link
                                              href={`/learn/curriculum/lesson/${les.slug || les.id}`}
                                              className="px-4 py-2 bg-[#D0021B] hover:bg-[#D0021B]/95 text-white text-xs font-bold rounded-xl transition duration-150 text-center shadow-xs shrink-0"
                                            >
                                              {completed ? "Study Again" : "Study Lesson"}
                                            </Link>
                                          </div>

                                          {/* Practice Drills list */}
                                          {les.practices && les.practices.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[var(--divider)]/40">
                                              {les.practices.map((prac) => {
                                                const pCfg = PRACTICE_TYPE_CONFIG[prac.practice_type ?? ""] ?? { label: "Practice", emoji: "🎯" };
                                                return (
                                                  <Link
                                                    key={prac.id}
                                                    href={`/learn/curriculum/lesson/${les.slug || les.id}`}
                                                    className="px-2.5 py-0.5 text-[9px] font-semibold rounded-full bg-[#D0021B]/5 text-[#D0021B] border border-[#D0021B]/10 hover:bg-[#D0021B]/10 transition"
                                                    title={prac.description ?? prac.title}
                                                  >
                                                    {pCfg.emoji} {prac.title}
                                                  </Link>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Tree connector to the next module */}
                    <div className="pt-2 flex flex-col items-center gap-2 border-t border-dashed border-[var(--divider)]">
                      {nextMod ? (
                        <button
                          type="button"
                          onClick={() => {
                            const locked = isModuleLocked(nextMod, isLoggedIn);
                            if (locked) {
                              setShowLockModal(true);
                            } else {
                              setActiveModuleId(nextMod.id);
                              updateUrlParams(activeLevel, nextMod.id);
                            }
                          }}
                          className="flex items-center gap-3 p-3 rounded-2xl border border-[var(--divider)] hover:border-primary/50 hover:shadow-sm transition bg-white w-full max-w-sm mt-2"
                        >
                          <div className="relative w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-[#FAF8F5]">
                            <Image
                              src={getModuleImage(activeLevel, nextMod.code, nextMod.title)}
                              alt={nextMod.title}
                              fill
                              sizes="40px"
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                          <div className="text-left min-w-0">
                            <span className="text-[9px] uppercase text-secondary font-bold tracking-wide">Next Module</span>
                            <p className="font-heading text-xs font-bold text-charcoal line-clamp-1">{nextMod.title}</p>
                          </div>
                          <span className="ml-auto text-primary shrink-0">↓</span>
                        </button>
                      ) : (
                        <div className="text-center py-3">
                          <span className="text-2xl block mb-1">🎉</span>
                          <p className="text-secondary text-xs">You&apos;ve reached the end of the {activeLevel} course roadmap.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Access Gate Prompt Modal */}
      <LockedModulePrompt isOpen={showLockModal} onClose={() => setShowLockModal(false)} />
    </div>
  );
}
