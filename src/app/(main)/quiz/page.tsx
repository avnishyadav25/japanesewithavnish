"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Question {
  id: string;
  question_text: string;
  options: string[];
  correct_index: number;
  jlpt_level: string;
}

interface Step {
  question: Question;
  level: string;
  selectedIndex: number | null; // null = unanswered, -1 = unsure, 0..3 = chosen
}

const JLPT_LEVELS = ["N5", "N4", "N3", "N2", "N1"];
const TARGET_QUESTION_COUNT = 25;

export default function QuizPage() {
  const router = useRouter();
  const [questionPool, setQuestionPool] = useState<Question[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // 1. Fetch entire question pool on mount
  useEffect(() => {
    fetch("/api/quiz/questions")
      .then((r) => r.json())
      .then((data) => {
        if (data.questions && data.questions.length > 0) {
          const pool: Question[] = data.questions;
          setQuestionPool(pool);

          // Restore progress if possible, otherwise initialize
          try {
            const raw = window.localStorage.getItem("jlpt_adaptive_quiz_state_v1");
            if (raw) {
              const parsed = JSON.parse(raw) as {
                steps: Step[];
                currentIndex: number;
              };
              if (parsed && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
                setSteps(parsed.steps);
                setCurrentIndex(parsed.currentIndex);
                setLoading(false);
                return;
              }
            }
          } catch {
            // fallback to init
          }

          // Initial step at N3
          const n3Pool = pool.filter((q) => q.jlpt_level.toUpperCase() === "N3");
          const firstQuestion = n3Pool.length > 0 
            ? n3Pool[Math.floor(Math.random() * n3Pool.length)]
            : pool[Math.floor(Math.random() * pool.length)];

          setSteps([{
            question: firstQuestion,
            level: firstQuestion.jlpt_level,
            selectedIndex: null
          }]);
          setCurrentIndex(0);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load quiz pool", err);
        setLoading(false);
      });
  }, []);

  // 2. Persist progress
  useEffect(() => {
    if (steps.length === 0) return;
    try {
      window.localStorage.setItem(
        "jlpt_adaptive_quiz_state_v1",
        JSON.stringify({ steps, currentIndex })
      );
    } catch {
      // ignore localstorage errors
    }
  }, [steps, currentIndex]);

  if (loading) {
    return (
      <div className="py-24 px-4 bg-[#FAF8F5] min-h-screen">
        <div className="max-w-[1200px] mx-auto text-center">
          <p className="text-secondary">Loading adaptive placement quiz...</p>
        </div>
      </div>
    );
  }

  const currentStep = steps[currentIndex];
  if (!currentStep) {
    return (
      <div className="py-24 px-4 bg-[#FAF8F5] min-h-screen">
        <div className="max-w-[1200px] mx-auto text-center">
          <p className="text-secondary">No questions available. Please try again later.</p>
        </div>
      </div>
    );
  }

  const q = currentStep.question;
  const options = Array.isArray(q.options) ? q.options : [];
  const selectedIndex = currentStep.selectedIndex;
  const progress = ((currentIndex + 1) / TARGET_QUESTION_COUNT) * 100;

  function handleSelect(optionIndex: number) {
    const newSteps = [...steps];
    newSteps[currentIndex].selectedIndex = optionIndex;
    setSteps(newSteps);
  }

  function getNextQuestion(baseSteps: Step[], nextLevel: string): Question {
    // Filter out already asked questions
    const askedIds = new Set(baseSteps.map((s) => s.question.id));
    let levelPool = questionPool.filter(
      (q) => q.jlpt_level.toUpperCase() === nextLevel.toUpperCase() && !askedIds.has(q.id)
    );

    // If level pool is empty, expand to nearest level
    if (levelPool.length === 0) {
      levelPool = questionPool.filter((q) => !askedIds.has(q.id));
    }

    // Default fallback
    if (levelPool.length === 0) {
      return questionPool[Math.floor(Math.random() * questionPool.length)];
    }

    return levelPool[Math.floor(Math.random() * levelPool.length)];
  }

  function handleNextOrUnsure(forceUnsure = false) {
    let finalSelectedIndex = selectedIndex;
    if (forceUnsure) {
      finalSelectedIndex = -1;
      const newSteps = [...steps];
      newSteps[currentIndex].selectedIndex = -1;
      setSteps(newSteps);
    }

    const isCorrect = finalSelectedIndex === q.correct_index;
    
    // Check if we are finished
    if (currentIndex === TARGET_QUESTION_COUNT - 1) {
      // Calculate final recommended level
      const updatedSteps = [...steps];
      updatedSteps[currentIndex].selectedIndex = finalSelectedIndex;
      
      const recommendedLevel = calculateRecommendedLevel(updatedSteps);
      const totalCorrect = updatedSteps.filter(
        (s) => s.selectedIndex === s.question.correct_index
      ).length;

      // Clear localStorage
      try {
        window.localStorage.removeItem("jlpt_adaptive_quiz_state_v1");
      } catch {
        // ignore
      }

      router.push(
        `/quiz/result?recommendedLevel=${recommendedLevel}&score=${totalCorrect}&total=${TARGET_QUESTION_COUNT}`
      );
      return;
    }

    // Determine next level
    const currentLevelIdx = JLPT_LEVELS.indexOf(currentStep.level.toUpperCase());
    let nextLevelIdx = currentLevelIdx;
    if (isCorrect) {
      nextLevelIdx = Math.min(JLPT_LEVELS.length - 1, currentLevelIdx + 1);
    } else {
      nextLevelIdx = Math.max(0, currentLevelIdx - 1);
    }
    const nextLevel = JLPT_LEVELS[nextLevelIdx];

    // Branch off or progress forward
    const baseSteps = steps.slice(0, currentIndex + 1);
    
    // If the next step already exists and has the same question/level, just advance.
    // However, if the user changed their answer, we branch and create a new future path.
    const hasExistingNext = steps[currentIndex + 1] !== undefined;
    const sameLevel = hasExistingNext && steps[currentIndex + 1].level.toUpperCase() === nextLevel.toUpperCase();
    
    if (hasExistingNext && sameLevel) {
      setCurrentIndex(currentIndex + 1);
    } else {
      const nextQuestion = getNextQuestion(baseSteps, nextLevel);
      const newSteps = [
        ...baseSteps,
        {
          question: nextQuestion,
          level: nextQuestion.jlpt_level,
          selectedIndex: null,
        },
      ];
      setSteps(newSteps);
      setCurrentIndex(currentIndex + 1);
    }
  }

  function handleBack() {
    if (currentIndex === 0) return;
    setCurrentIndex(currentIndex - 1);
  }

  function handleExit() {
    try {
      window.localStorage.removeItem("jlpt_adaptive_quiz_state_v1");
    } catch {
      // ignore
    }
    router.push("/jlpt");
  }

  function calculateRecommendedLevel(completedSteps: Step[]): string {
    if (!completedSteps.length) return "N5";
    
    // Look at last 8 steps for convergence
    const lastSteps = completedSteps.slice(-8);
    const levelValues: Record<string, number> = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5 };
    const valueToLevel: Record<number, string> = { 1: "N5", 2: "N4", 3: "N3", 4: "N2", 5: "N1" };
    
    let totalValue = 0;
    let correctCount = 0;
    for (const s of lastSteps) {
      const isCorrect = s.selectedIndex === s.question.correct_index;
      totalValue += levelValues[s.level.toUpperCase()] || 1;
      if (isCorrect) correctCount++;
    }
    const avgValue = totalValue / lastSteps.length;
    const accuracy = correctCount / lastSteps.length;
    
    let finalVal = Math.round(avgValue);
    if (accuracy < 0.4) {
      finalVal = Math.max(1, finalVal - 1);
    } else if (accuracy > 0.8) {
      finalVal = Math.min(5, finalVal + 1);
    }
    return valueToLevel[finalVal] || "N5";
  }

  const isLast = currentIndex === TARGET_QUESTION_COUNT - 1;
  const canGoNext = selectedIndex !== null;

  return (
    <div className="bg-[#FAF8F5] py-12 sm:py-16 px-4 sm:px-6 min-h-screen">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-6">
          <Link
            href="/start-here"
            className="text-sm text-secondary hover:text-primary"
          >
            ← Back to Start Here
          </Link>
        </div>
        <div className="bento-grid items-start gap-6">
          <div className="bento-span-4 card">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-secondary font-medium">
                Question {currentIndex + 1} of {TARGET_QUESTION_COUNT} ({currentStep.level})
              </p>
              <button
                type="button"
                onClick={handleExit}
                className="text-xs text-secondary hover:text-primary underline-offset-2 hover:underline"
              >
                Exit quiz
              </button>
            </div>
            <div className="h-1.5 bg-[var(--divider)] rounded-full mb-6 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <h2 className="font-heading text-2xl font-bold text-charcoal mb-2">
              {q.question_text}
            </h2>
            <p className="text-secondary text-sm mb-6">
              Choose the best answer.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {options.map((opt, i) => {
                const selected = selectedIndex === i;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelect(i)}
                    className={`text-left px-5 py-4 rounded-bento border-2 transition-all ${
                      selected
                        ? "border-primary bg-[#FFF7F7] shadow-sm"
                        : "border-[var(--divider)] bg-white hover:border-primary hover:bg-[#FFF7F7]"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => handleNextOrUnsure(true)}
              className="mt-4 text-sm text-secondary hover:text-primary underline-offset-2 hover:underline block"
            >
              I&apos;m not sure
            </button>

            <div className="mt-8 flex items-center justify-between">
              <button
                type="button"
                onClick={handleBack}
                disabled={currentIndex === 0}
                className="text-sm px-4 py-2 rounded-bento border border-[var(--divider)] text-secondary disabled:opacity-50 hover:border-primary hover:text-primary transition"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => handleNextOrUnsure(false)}
                disabled={!canGoNext}
                className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLast ? "Finish Quiz" : "Next"}
              </button>
            </div>
          </div>

          <div className="bento-span-2 card sticky top-24 hidden lg:flex flex-col justify-between bg-base border-[var(--divider)]">
            <div>
              <h2 className="font-heading text-lg font-semibold text-charcoal mb-2">
                How this quiz works
              </h2>
              <ul className="text-secondary text-sm space-y-1 mb-4">
                <li>25 questions • 5–8 minutes</li>
                <li>Computer Adaptive: Gets harder or easier based on your answers.</li>
                <li>Determines your exact JLPT level.</li>
                <li>Recommends the right learning path for you.</li>
              </ul>
            </div>
            <div className="mt-4">
              <Link
                href="/jlpt"
                className="text-sm text-primary font-medium hover:underline"
              >
                Prefer to browse levels? →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
