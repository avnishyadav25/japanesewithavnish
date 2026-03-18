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

function formatTotalTime(minutes: number): string {
  if (minutes < 60) return `~${minutes} min`;
  const hrs = Math.round(minutes / 60);
  return `~${hrs} hr${hrs !== 1 ? "s" : ""}`;
}

function CircleIcon({
  size = 8,
  imageUrl,
  completed,
  progressPercent,
}: {
  size?: number;
  imageUrl?: string | null;
  /** When true, show green border (lesson/submodule/module fully complete) */
  completed?: boolean;
  /** 0–100: show gray circle with green progress arc (submodule/module in progress). Ignored if completed. */
  progressPercent?: number;
}) {
  const s = size * 4;
  const isComplete = completed ?? (progressPercent != null && progressPercent >= 100);
  const showProgress = progressPercent != null && progressPercent > 0 && !isComplete;
  const ringClass = isComplete
    ? "ring-2 ring-green-500"
    : "ring-2 ring-gray-300";
  return (
    <span
      className={`relative inline-flex items-center justify-center rounded-full shrink-0 overflow-hidden bg-[var(--base)] ${ringClass}`}
      style={{ width: s, height: s }}
      aria-hidden
    >
      {showProgress && (
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(rgb(34 197 94) 0, rgb(34 197 94) ${progressPercent}%, rgb(209 213 219) ${progressPercent}%, rgb(209 213 219) 100%)`,
          }}
          aria-hidden
        />
      )}
      <span
        className={`relative inline-flex items-center justify-center rounded-full overflow-hidden bg-primary/10 text-primary ${showProgress ? "bg-[var(--base)]" : ""}`}
        style={{ width: Math.max(0, s - 6), height: Math.max(0, s - 6) }}
      >
        {imageUrl?.trim() ? (
          <img src={imageUrl} alt="" width={s - 6} height={s - 6} className="w-full h-full object-cover" />
        ) : (
          <img src="/icon-learning.svg" alt="" width={size * 2.5} height={size * 2.5} className="opacity-90" />
        )}
      </span>
    </span>
  );
}

export function CurriculumBrowserClient() {
  const [data, setData] = useState<CurriculumResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedLevelCode, setExpandedLevelCode] = useState<string | null>(null);
  const [expandedModuleIds, setExpandedModuleIds] = useState<Set<string>>(new Set());
  const [expandedSubmoduleIds, setExpandedSubmoduleIds] = useState<Set<string>>(new Set());
  const [expandedLessonIds, setExpandedLessonIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/learn/curriculum?path=1")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setExpandedLevelCode(d.currentLevelCode ?? "N5");
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-secondary">Loading path…</p>;
  if (!data?.levels?.length) {
    return (
      <p className="text-secondary">
        No curriculum yet. Check back later or go to your{" "}
        <Link href="/learn/dashboard" className="text-primary hover:underline">dashboard</Link> for your next lesson.
      </p>
    );
  }

  const levels = data.levels as Level[];
  const progressPercent = data.pathProgressPercent ?? 0;
  const totalMinutes = data.totalEstimatedMinutes ?? 0;
  const completedSet = new Set(data.completedLessonIds ?? []);

  const pathSteps = (data.pathSteps ?? []) as { type: string; id: string; code: string; title: string; completed?: boolean }[];
  const nextLesson = pathSteps.find((s) => s.type === "lesson" && !s.completed);
  const advanceBlocked = data.advanceBlocked ?? false;
  const advanceBlockReason = data.advanceBlockReason ?? null;
  const dueReviewsCount = data.dueReviewsCount ?? 0;

  function expandAllForLevel(level: Level) {
    const modIds = new Set(level.modules.map((m) => m.id));
    const subIds = new Set(level.modules.flatMap((m) => m.submodules.map((s) => s.id)));
    const lesIds = new Set(level.modules.flatMap((m) => m.submodules.flatMap((s) => s.lessons.map((l) => l.id))));
    setExpandedModuleIds(modIds);
    setExpandedSubmoduleIds(subIds);
    setExpandedLessonIds(lesIds);
  }

  function toggleModule(id: string) {
    setExpandedModuleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleSubmodule(id: string) {
    setExpandedSubmoduleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleLesson(id: string) {
    setExpandedLessonIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderLevelExpanded(level: Level) {
    return (
      <div className="border-t border-[var(--divider)]">
        <div className="px-4 pt-2 pb-1 flex justify-end">
          <button
            type="button"
            onClick={() => expandAllForLevel(level)}
            className="text-sm text-primary font-medium hover:underline"
          >
            Expand all
          </button>
        </div>
        <div className="p-4 pt-0 space-y-0">
          {level.modules.map((mod) => {
            const modOpen = expandedModuleIds.has(mod.id);
            const modLessons = mod.submodules.flatMap((s) => s.lessons);
            const modCompletedCount = modLessons.filter((l) => completedSet.has(l.id)).length;
            const modTotal = modLessons.length;
            const modCompleted = modTotal > 0 && modCompletedCount === modTotal;
            const modProgressPercent = modTotal > 0 ? Math.round((modCompletedCount / modTotal) * 100) : 0;
            return (
              <div key={mod.id} className="py-0.5">
                <button
                  type="button"
                  onClick={() => toggleModule(mod.id)}
                  className="w-full flex items-center gap-2 py-2.5 px-3 rounded-bento text-left font-medium text-charcoal hover:bg-[var(--divider)]/20 transition"
                  aria-expanded={modOpen}
                >
                  <CircleIcon size={7} imageUrl={mod.feature_image_url} completed={modCompleted} progressPercent={modProgressPercent} />
                  <span className="flex-1 min-w-0">Module {mod.code} — {mod.title}</span>
                  <span className="text-secondary shrink-0" aria-hidden>{modOpen ? "−" : "+"}</span>
                </button>
                {modOpen && (
                  <div className="pl-4 ml-2 border-l-2 border-[var(--divider)] space-y-0">
                    {mod.submodules.map((sub) => {
                      const subOpen = expandedSubmoduleIds.has(sub.id);
                      const subCompletedCount = sub.lessons.filter((l) => completedSet.has(l.id)).length;
                      const subTotal = sub.lessons.length;
                      const subCompleted = subTotal > 0 && subCompletedCount === subTotal;
                      const subProgressPercent = subTotal > 0 ? Math.round((subCompletedCount / subTotal) * 100) : 0;
                      return (
                        <div key={sub.id} className="py-0.5">
                          <button
                            type="button"
                            onClick={() => toggleSubmodule(sub.id)}
                            className="w-full flex items-center gap-2 py-2 px-3 rounded-bento text-left text-sm text-charcoal hover:bg-[var(--divider)]/15 transition"
                            aria-expanded={subOpen}
                          >
                            <CircleIcon size={6} imageUrl={sub.feature_image_url} completed={subCompleted} progressPercent={subProgressPercent} />
                            <span className="flex-1 min-w-0">Submodule {sub.code} — {sub.title}</span>
                            <span className="text-secondary shrink-0" aria-hidden>{subOpen ? "−" : "+"}</span>
                          </button>
                          {subOpen && (
                            <div className="pl-4 ml-2 border-l-2 border-[var(--divider)]/70 space-y-0">
                              {sub.lessons.map((les) => {
                                const lessonOpen = expandedLessonIds.has(les.id);
                                const completed = completedSet.has(les.id);
                                return (
                                  <div key={les.id} className="py-0.5">
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => toggleLesson(les.id)}
                                        className="flex items-center gap-2 py-2 px-3 rounded-bento text-left text-sm flex-1 min-w-0 hover:bg-[var(--divider)]/15 transition"
                                        aria-expanded={lessonOpen}
                                      >
                                        <CircleIcon size={5} imageUrl={les.feature_image_url} completed={completed} />
                                        <span className="truncate flex-1">
                                          {completed && <span className="text-primary mr-1.5" aria-label="Completed">✓</span>}
                                          Lesson {les.code} — {les.title}
                                        </span>
                                        <span className="text-secondary shrink-0" aria-hidden>{lessonOpen ? "−" : "+"}</span>
                                      </button>
                                      <Link
                                        href={`/learn/curriculum/lesson/${les.id}`}
                                        className="shrink-0 text-primary text-sm font-medium hover:underline py-2"
                                      >
                                        Open
                                      </Link>
                                    </div>
                                    {lessonOpen && (
                                      <div className="pl-4 ml-2 border-l-2 border-[var(--divider)]/50 py-2 space-y-1">
                                        <span className="text-xs font-medium text-secondary uppercase tracking-wide">Exercises</span>
                                        {les.exercises?.length ? (
                                          <ul className="list-none space-y-1">
                                            {les.exercises.map((ex) => (
                                              <li key={ex.id}>
                                                <Link
                                                  href={`/learn/curriculum/lesson/${les.id}`}
                                                  className="text-sm text-primary hover:underline"
                                                >
                                                  {ex.title?.trim() || ex.content_slug || `Exercise`}
                                                </Link>
                                              </li>
                                            ))}
                                          </ul>
                                        ) : (
                                          <p className="text-secondary text-sm">No exercises yet.</p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Path header: progress bar + mascot */}
      <div className="rounded-bento border border-[var(--divider)] bg-white p-4 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="font-heading text-xl font-bold text-charcoal">Japanese with Avnish Path</h2>
          <p className="text-secondary text-sm mt-1">
            {progressPercent}% complete
            {totalMinutes > 0 && (
              <span className="ml-2"> · {formatTotalTime(totalMinutes)} total</span>
            )}
          </p>
          <div className="mt-2 h-2 bg-[var(--divider)] rounded-full overflow-hidden max-w-xs">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${Math.min(100, progressPercent)}%` }}
            />
          </div>
        </div>
        <div className="flex-shrink-0 w-16 h-20 relative" aria-hidden>
          <Image src="/mascot-placeholder.svg" alt="" width={64} height={80} className="object-contain" />
        </div>
      </div>

      {advanceBlocked && (dueReviewsCount > 0 || advanceBlockReason) && (
        <div className="rounded-bento border border-primary/50 bg-primary/10 p-4">
          <p className="text-sm font-medium text-charcoal">
            {advanceBlockReason ?? `${dueReviewsCount} reviews due. Complete them to unlock your next lesson.`}
          </p>
          <Link href="/review" className="text-primary text-sm font-medium hover:underline mt-1 inline-block">
            Do reviews →
          </Link>
        </div>
      )}

      {/* Levels: one expanded (vertical drill-down), others collapsed */}
      {levels.map((level) => {
        const isExpanded = expandedLevelCode === level.code;
        return (
          <section key={level.id} className="rounded-bento border border-[var(--divider)] bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => {
                setExpandedLevelCode(isExpanded ? null : level.code);
                if (!isExpanded) {
                  setExpandedModuleIds(new Set());
                  setExpandedSubmoduleIds(new Set());
                  setExpandedLessonIds(new Set());
                }
              }}
              className="w-full flex items-center justify-between font-heading font-bold text-charcoal uppercase tracking-wide px-4 py-3 border-b border-[var(--divider)] bg-[var(--base)] hover:bg-[var(--divider)]/20 transition text-left"
              aria-expanded={isExpanded}
            >
              <span>{level.code} — {level.name}</span>
              <span className="text-secondary shrink-0" aria-hidden>{isExpanded ? "−" : "+"}</span>
            </button>
            {isExpanded && renderLevelExpanded(level)}
          </section>
        );
      })}

      {/* Next up + mascot */}
      {nextLesson && (
        <div className="rounded-bento border border-primary/30 bg-primary/5 p-4 flex items-center gap-4 flex-wrap">
          <div className="w-12 h-14 relative flex-shrink-0" aria-hidden>
            <Image src="/mascot-placeholder.svg" alt="" width={48} height={56} className="object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-secondary">Next up</p>
            <Link
              href={`/learn/curriculum/lesson/${nextLesson.id}`}
              className="font-medium text-primary hover:underline"
            >
              {nextLesson.code} — {nextLesson.title}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
