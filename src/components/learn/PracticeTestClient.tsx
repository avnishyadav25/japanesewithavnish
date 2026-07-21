"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  familyForItemType,
  labelForItemType,
  getItemTypeDef,
  ITEM_FAMILY_LABELS,
  ITEM_FAMILY_LEARN_PATH,
  type ItemFamily,
} from "@/lib/practiceTest/itemTypes";

export type ClientQuestion = {
  id: string;
  question_text: string;
  item_type: string | null;
  options: string[];
  correct_index: number;
  explanation: string | null;
  audio_url: string | null;
};

export type ClientSection = {
  id: string;
  title: string;
  section_type: "vocabulary" | "grammar" | "reading" | "listening";
  time_limit_minutes: number | null;
  passage: string | null;
  audio_url: string | null;
  questions: ClientQuestion[];
};

type Phase = "intro" | "in_progress" | "result";

type FamilyScores = Partial<Record<ItemFamily, { score: number; total: number }>>;
type ItemTypeScore = { itemType: string; score: number; total: number };

type Result = {
  score: number;
  total: number;
  passed: boolean;
  sectionScores: { id: string; title: string; score: number; total: number }[];
  familyScores: FamilyScores;
  itemTypeScores: ItemTypeScore[];
  durationSeconds: number;
};

/** Groups consecutive same-item_type questions within a section's question list — a section
 * stores a flat sort_order-ordered list, grouping is a pure presentation concern. Used for both
 * in-test rendering and results review, so a group header (JLPT item-type name + instructions)
 * always shows in the same place regardless of phase. */
function groupConsecutiveByItemType<T extends { item_type: string | null }>(
  questions: T[]
): { itemType: string | null; questions: T[] }[] {
  const groups: { itemType: string | null; questions: T[] }[] = [];
  for (const q of questions) {
    const last = groups[groups.length - 1];
    if (last && last.itemType === q.item_type) {
      last.questions.push(q);
    } else {
      groups.push({ itemType: q.item_type, questions: [q] });
    }
  }
  return groups;
}

/** Single pass over every question in every section producing both the fine-grained
 * accuracy-by-item-type list and the coarser 5-family weak-area breakdown (kanji_reading
 * items bucket into "Kanji", separate from other vocabulary item types, via familyForItemType). */
function computeBreakdowns(sections: ClientSection[], answers: Record<string, number>) {
  const familyScores: FamilyScores = {};
  const itemTypeMap = new Map<string, { score: number; total: number }>();

  for (const s of sections) {
    for (const q of s.questions) {
      if (!q.item_type) continue;
      const isCorrect = answers[q.id] === q.correct_index;

      const itEntry = itemTypeMap.get(q.item_type) ?? { score: 0, total: 0 };
      itEntry.total += 1;
      if (isCorrect) itEntry.score += 1;
      itemTypeMap.set(q.item_type, itEntry);

      const family = familyForItemType(q.item_type);
      if (family) {
        const famEntry = familyScores[family] ?? { score: 0, total: 0 };
        famEntry.total += 1;
        if (isCorrect) famEntry.score += 1;
        familyScores[family] = famEntry;
      }
    }
  }

  const itemTypeScores: ItemTypeScore[] = Array.from(itemTypeMap.entries()).map(([itemType, v]) => ({ itemType, ...v }));
  return { familyScores, itemTypeScores };
}

function formatMMSS(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Multi-section timed test runner — honor-system scoring (same posture as the existing
 * /learn/exam MockExamClient: correct answers ship to the client, self-scored, then logged
 * server-side via /api/learn/practice-tests/[testId]/submit for history/analytics). Each
 * section counts down independently when it has a time_limit_minutes; sections without one
 * are untimed. Once a learner advances past a section they cannot return to it, matching
 * real JLPT section pacing. */
export function PracticeTestClient({
  testId,
  title,
  sections,
  passingScorePercent,
  jlptLevel,
  durationMinutes,
}: {
  testId: string;
  title: string;
  sections: ClientSection[];
  passingScorePercent: number;
  jlptLevel?: string | null;
  durationMinutes?: number;
}) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [sectionIndex, setSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [showRetry, setShowRetry] = useState(false);

  const currentSection = sections[sectionIndex];
  const isLastSection = sectionIndex === sections.length - 1;

  const answersRef = useRef(answers);
  answersRef.current = answers;

  const scoreAndSubmit = useCallback(() => {
    const sectionScores = sections.map((s) => {
      const total = s.questions.length;
      const score = s.questions.filter((q) => answersRef.current[q.id] === q.correct_index).length;
      return { id: s.id, title: s.title, score, total };
    });
    const total = sectionScores.reduce((sum, s) => sum + s.total, 0);
    const score = sectionScores.reduce((sum, s) => sum + s.score, 0);
    const passed = total > 0 && (score / total) * 100 >= passingScorePercent;
    const { familyScores, itemTypeScores } = computeBreakdowns(sections, answersRef.current);
    const durationSeconds = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;

    setResult({ score, total, passed, sectionScores, familyScores, itemTypeScores, durationSeconds });
    setPhase("result");

    fetch("/api/learn/practice-tests/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        testId,
        score,
        totalQuestions: total,
        passed,
        sectionScores: Object.fromEntries(sectionScores.map((s) => [s.id, { score: s.score, total: s.total }])),
        answers: answersRef.current,
        durationSeconds,
      }),
    }).catch(() => {});
  }, [sections, passingScorePercent, testId, startedAt]);

  const advanceRef = useRef<() => void>(() => {});
  advanceRef.current = () => {
    if (isLastSection) {
      scoreAndSubmit();
    } else {
      setSectionIndex((i) => i + 1);
    }
  };

  useEffect(() => {
    if (phase !== "in_progress" || !currentSection) return;
    if (!currentSection.time_limit_minutes) {
      setTimeLeftSeconds(null);
      return;
    }
    setTimeLeftSeconds(currentSection.time_limit_minutes * 60);
    const t = setInterval(() => {
      setTimeLeftSeconds((s) => {
        if (s === null) return null;
        if (s <= 1) {
          clearInterval(t);
          advanceRef.current();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, sectionIndex]);

  if (phase === "intro") {
    return (
      <button
        type="button"
        onClick={() => {
          setStartedAt(Date.now());
          setPhase("in_progress");
        }}
        className="btn-primary w-full py-3 text-sm font-bold"
      >
        Start test
      </button>
    );
  }

  if (phase === "result" && result) {
    const familyEntries = (Object.entries(result.familyScores) as [ItemFamily, { score: number; total: number }][]).filter(
      ([, v]) => v.total > 0
    );
    const weakFamilies = familyEntries.filter(([, v]) => v.score / v.total < 0.7);
    const wrongQuestionIds = new Set(
      sections.flatMap((s) => s.questions).filter((q) => answersRef.current[q.id] !== q.correct_index).map((q) => q.id)
    );

    return (
      <div className="bg-white border border-[var(--divider)] rounded-bento p-6 space-y-4">
        <h2 className="font-heading text-xl font-semibold text-charcoal">{title} — Result</h2>
        <p className="text-charcoal text-lg">
          {result.score} / {result.total} ({Math.round((result.score / Math.max(result.total, 1)) * 100)}%) —{" "}
          <span className={result.passed ? "text-emerald-600 font-bold" : "text-red-600 font-bold"}>
            {result.passed ? "Passed" : "Not passed"}
          </span>
        </p>
        <p className="text-secondary text-xs">
          Time used: {formatMMSS(result.durationSeconds)}
          {durationMinutes ? ` (budget: ${durationMinutes} min)` : ""}
        </p>

        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-secondary uppercase tracking-wider">Section score</p>
          {result.sectionScores.map((s) => (
            <div key={s.id} className="flex justify-between text-sm border-b border-[var(--divider)] py-1.5">
              <span className="text-charcoal">{s.title}</span>
              <span className="text-secondary">{s.score} / {s.total}</span>
            </div>
          ))}
        </div>

        {result.itemTypeScores.length > 0 && (
          <div className="pt-2 space-y-1.5">
            <p className="text-[10px] font-bold text-secondary uppercase tracking-wider">Accuracy by item type</p>
            {result.itemTypeScores.map((it) => {
              const pct = it.total > 0 ? Math.round((it.score / it.total) * 100) : 0;
              return (
                <div key={it.itemType} className="flex items-center justify-between text-sm">
                  <span className="text-charcoal">{labelForItemType(it.itemType)}</span>
                  <span className={pct < 70 ? "text-red-600 font-semibold" : "text-emerald-600 font-semibold"}>
                    {it.score} / {it.total} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {familyEntries.length > 0 && (
          <div className="pt-4 border-t border-[var(--divider)] space-y-3">
            <h3 className="font-heading text-sm font-semibold text-charcoal">Weak areas</h3>
            <div className="space-y-1.5">
              {familyEntries.map(([family, v]) => {
                const pct = v.total > 0 ? Math.round((v.score / v.total) * 100) : 0;
                return (
                  <div key={family} className="flex items-center justify-between text-sm">
                    <span className="text-charcoal">{ITEM_FAMILY_LABELS[family]}</span>
                    <span className={pct < 70 ? "text-red-600 font-semibold" : "text-emerald-600 font-semibold"}>
                      {v.score} / {v.total} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
            {weakFamilies.length > 0 && (
              <div className="bg-[#FFF7F7] border border-[#D0021B]/15 rounded-bento p-3 space-y-1.5">
                <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Recommended lessons</p>
                {weakFamilies.map(([family]) => (
                  <Link
                    key={family}
                    href={`${ITEM_FAMILY_LEARN_PATH[family]}${jlptLevel ? `?level=${jlptLevel.toLowerCase()}` : ""}`}
                    className="block text-sm text-primary hover:underline"
                  >
                    Practice more {ITEM_FAMILY_LABELS[family]}{jlptLevel ? ` at ${jlptLevel}` : ""} →
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        <details className="text-sm">
          <summary className="cursor-pointer text-primary font-medium">Review answers</summary>
          <div className="mt-3 space-y-4">
            {sections.map((s) => {
              let counter = 0;
              return (
                <div key={s.id}>
                  <p className="font-semibold text-charcoal text-xs uppercase tracking-wide mb-2">{s.title}</p>
                  {groupConsecutiveByItemType(s.questions).map((group, gi) => (
                    <div key={gi} className="mb-3">
                      {group.itemType && (
                        <p className="text-[11px] font-bold text-secondary mb-1.5">{labelForItemType(group.itemType)}</p>
                      )}
                      {group.questions.map((q) => {
                        counter += 1;
                        const userAnswer = answersRef.current[q.id];
                        const isCorrect = userAnswer === q.correct_index;
                        return (
                          <div key={q.id} className="mb-3 pl-2 border-l-2 border-[var(--divider)]">
                            <p className="text-charcoal">{counter}. {q.question_text}</p>
                            <p className={isCorrect ? "text-emerald-600" : "text-red-600"}>
                              Your answer: {userAnswer != null ? q.options[userAnswer] : "(none)"} {isCorrect ? "✓" : `— correct: ${q.options[q.correct_index]}`}
                            </p>
                            {q.explanation && <p className="text-secondary text-xs mt-1">{q.explanation}</p>}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </details>

        {wrongQuestionIds.size > 0 && (
          <div className="pt-4 border-t border-[var(--divider)]">
            {!showRetry ? (
              <button
                type="button"
                onClick={() => setShowRetry(true)}
                className="w-full py-2.5 text-sm font-bold rounded-xl border border-primary/30 text-primary hover:bg-primary/5 transition"
              >
                Retry {wrongQuestionIds.size} incorrect question{wrongQuestionIds.size === 1 ? "" : "s"}
              </button>
            ) : (
              <div>
                <h3 className="font-heading text-sm font-semibold text-charcoal mb-3">Retry incorrect questions</h3>
                <RetryIncorrectQuiz sections={sections} wrongQuestionIds={wrongQuestionIds} />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (!currentSection) return null;
  const m = timeLeftSeconds != null ? Math.floor(timeLeftSeconds / 60) : null;
  const s = timeLeftSeconds != null ? timeLeftSeconds % 60 : null;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center rounded-bento border border-[var(--divider)] bg-white px-4 py-2.5">
        <span className="font-medium text-charcoal">Section {sectionIndex + 1} / {sections.length}: {currentSection.title}</span>
        {timeLeftSeconds != null && (
          <span className="text-primary font-mono text-sm">Time: {m}:{String(s).padStart(2, "0")}</span>
        )}
      </div>

      {currentSection.section_type === "reading" && currentSection.passage && (
        <div className="bg-base border border-[var(--divider)] rounded-bento p-5 whitespace-pre-wrap text-charcoal text-sm leading-relaxed">
          {currentSection.passage}
        </div>
      )}

      {currentSection.section_type === "listening" && currentSection.audio_url && (
        <audio controls src={currentSection.audio_url} className="w-full">
          Your browser does not support audio playback.
        </audio>
      )}

      <div className="space-y-4">
        {(() => {
          let counter = 0;
          return groupConsecutiveByItemType(currentSection.questions).map((group, gi) => {
            const def = getItemTypeDef(group.itemType);
            return (
              <div key={gi} className="space-y-3">
                {group.itemType && (
                  <div className="pt-2">
                    <h4 className="text-xs font-bold text-primary uppercase tracking-wider">{def?.label ?? group.itemType}</h4>
                    {def?.groupInstructions && <p className="text-secondary text-xs mt-0.5">{def.groupInstructions}</p>}
                  </div>
                )}
                {group.questions.map((q) => {
                  counter += 1;
                  return (
                    <div key={q.id} className="rounded-bento border border-[var(--divider)] bg-white p-4">
                      <p className="font-medium text-charcoal mb-2">{counter}. {q.question_text}</p>
                      {q.audio_url && (
                        <audio controls src={q.audio_url} className="w-full mb-2">
                          Your browser does not support audio playback.
                        </audio>
                      )}
                      <ul className="space-y-1">
                        {q.options.map((opt, idx) => (
                          <li key={idx}>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name={q.id}
                                checked={answers[q.id] === idx}
                                onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: idx }))}
                                className="rounded"
                              />
                              <span>{opt}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            );
          });
        })()}
      </div>

      <button type="button" onClick={() => advanceRef.current()} className="btn-primary w-full py-3 text-sm font-bold">
        {isLastSection ? "Submit test" : "Next section"}
      </button>
    </div>
  );
}

/** Self-contained "retry incorrect questions" mini-quiz — deliberately NOT wired into the
 * Phase/timer/scoreAndSubmit machinery above (a retry isn't an official scored attempt, and
 * touching that state machine risks destabilizing the working test-taking flow for a v1 feature).
 * Filters each section's question list down to only the wrong ones rather than flattening them
 * into one synthetic section, so reading passages / listening audio stay attached to the
 * questions that depend on them. */
function RetryIncorrectQuiz({ sections, wrongQuestionIds }: { sections: ClientSection[]; wrongQuestionIds: Set<string> }) {
  const [retryAnswers, setRetryAnswers] = useState<Record<string, number>>({});
  const [checked, setChecked] = useState(false);

  const retrySections = sections
    .map((s) => ({ ...s, questions: s.questions.filter((q) => wrongQuestionIds.has(q.id)) }))
    .filter((s) => s.questions.length > 0);

  const totalRetry = retrySections.reduce((sum, s) => sum + s.questions.length, 0);
  const correctRetry = retrySections.reduce(
    (sum, s) => sum + s.questions.filter((q) => retryAnswers[q.id] === q.correct_index).length,
    0
  );

  return (
    <div className="space-y-4">
      {retrySections.map((s) => (
        <div key={s.id} className="space-y-3">
          <p className="font-semibold text-charcoal text-xs uppercase tracking-wide">{s.title}</p>
          {s.section_type === "reading" && s.passage && (
            <div className="bg-base border border-[var(--divider)] rounded-bento p-4 whitespace-pre-wrap text-charcoal text-sm">
              {s.passage}
            </div>
          )}
          {s.section_type === "listening" && s.audio_url && (
            <audio controls src={s.audio_url} className="w-full">
              Your browser does not support audio playback.
            </audio>
          )}
          {s.questions.map((q, i) => {
            const selected = retryAnswers[q.id];
            return (
              <div key={q.id} className="rounded-bento border border-[var(--divider)] bg-white p-4">
                <p className="font-medium text-charcoal mb-2 text-sm">{i + 1}. {q.question_text}</p>
                {q.audio_url && (
                  <audio controls src={q.audio_url} className="w-full mb-2">
                    Your browser does not support audio playback.
                  </audio>
                )}
                <ul className="space-y-1">
                  {q.options.map((opt, idx) => {
                    const isSelected = selected === idx;
                    const isRight = idx === q.correct_index;
                    return (
                      <li key={idx}>
                        <label
                          className={`flex items-center gap-2 text-sm ${checked ? "cursor-default" : "cursor-pointer"} ${
                            checked && isRight ? "text-emerald-700 font-semibold" : checked && isSelected ? "text-red-600" : ""
                          }`}
                        >
                          <input
                            type="radio"
                            name={`retry-${q.id}`}
                            checked={isSelected}
                            disabled={checked}
                            onChange={() => setRetryAnswers((prev) => ({ ...prev, [q.id]: idx }))}
                            className="rounded"
                          />
                          <span>{opt}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                {checked && q.explanation && <p className="text-secondary text-xs mt-2">{q.explanation}</p>}
              </div>
            );
          })}
        </div>
      ))}

      {checked ? (
        <p className="text-charcoal font-semibold text-sm">Retry result: {correctRetry} / {totalRetry} correct</p>
      ) : (
        <button type="button" onClick={() => setChecked(true)} className="btn-primary w-full py-2.5 text-sm font-bold">
          Check answers
        </button>
      )}
    </div>
  );
}
