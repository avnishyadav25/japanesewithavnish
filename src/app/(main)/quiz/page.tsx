"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Question {
  id: string;
  question_text: string;
  options: string[];
  correct_index: number;
}

const SAMPLE_QUESTIONS: Question[] = [
  { id: "1", question_text: "What does こんにちは mean?", options: ["Good morning", "Hello", "Goodbye", "Thank you"], correct_index: 1 },
  { id: "2", question_text: "Which is the correct reading of 水?", options: ["hi", "mizu", "ki", "tsuki"], correct_index: 1 },
  { id: "3", question_text: "What particle indicates the subject?", options: ["を", "に", "は", "で"], correct_index: 2 },
  { id: "4", question_text: "How do you say 'I eat' in polite form?", options: ["食べる", "食べます", "食べた", "食べて"], correct_index: 1 },
  { id: "5", question_text: "What is 本 (hon) commonly used for?", options: ["Book", "Tree", "Car", "House"], correct_index: 0 },
  { id: "6", question_text: "Which is the past tense of 行く?", options: ["行きます", "行った", "行って", "行く"], correct_index: 1 },
  { id: "7", question_text: "What does ありがとう mean?", options: ["Sorry", "Please", "Thank you", "Hello"], correct_index: 2 },
  { id: "8", question_text: "How do you say 'big' in Japanese?", options: ["小さい", "大きい", "新しい", "古い"], correct_index: 1 },
  { id: "9", question_text: "What is 今日?", options: ["Yesterday", "Today", "Tomorrow", "Week"], correct_index: 1 },
  { id: "10", question_text: "Which level is the easiest JLPT level?", options: ["N1", "N2", "N3", "N5"], correct_index: 3 },
];

export default function QuizPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});

  useEffect(() => {
    fetch("/api/quiz/questions")
      .then((r) => r.json())
      .then((data) => {
        if (data.questions?.length) {
          setQuestions(data.questions.slice(0, 10));
        } else {
          setQuestions(SAMPLE_QUESTIONS);
        }
        setLoading(false);
      })
      .catch(() => {
        setQuestions(SAMPLE_QUESTIONS);
        setLoading(false);
      });
  }, []);

  // Restore progress if available
  useEffect(() => {
    if (!questions.length) return;
    try {
      const raw = window.localStorage.getItem("jlpt_quiz_state_v1");
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        currentIndex?: number;
        answers?: Record<number, number>;
        questionCount?: number;
      };
      if (
        parsed &&
        typeof parsed === "object" &&
        parsed.questionCount === questions.length
      ) {
        setAnswers(parsed.answers || {});
        const idx =
          typeof parsed.currentIndex === "number"
            ? Math.min(Math.max(parsed.currentIndex, 0), questions.length - 1)
            : 0;
        setCurrentIndex(idx);
      }
    } catch {
      // ignore restore errors
    }
  }, [questions.length]);

  // Persist progress
  useEffect(() => {
    if (!questions.length) return;
    try {
      window.localStorage.setItem(
        "jlpt_quiz_state_v1",
        JSON.stringify({
          currentIndex,
          answers,
          questionCount: questions.length,
        })
      );
    } catch {
      // ignore save errors
    }
  }, [questions.length, currentIndex, answers]);

  if (loading) {
    return (
      <div className="py-24 px-4">
        <div className="max-w-[1200px] mx-auto">
          <div className="bento-grid">
            <div className="bento-span-6 card p-12 text-center">
              <p className="text-secondary">Loading quiz...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const q = questions[currentIndex];
  if (!q) {
    return (
      <div className="py-24 px-4">
        <div className="bento-grid">
          <div className="bento-span-6 card p-12 text-center">
            <p className="text-secondary">No questions available.</p>
          </div>
        </div>
      </div>
    );
  }

  const options = Array.isArray(q.options) ? q.options : [];
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const selectedIndex = answers[currentIndex];

  function handleSelect(optionIndex: number) {
    setAnswers({ ...answers, [currentIndex]: optionIndex });
  }

  function handleNotSure() {
    // Use -1 to represent \"I'm not sure\" (always counted as incorrect)
    setAnswers({ ...answers, [currentIndex]: -1 });
  }

  function handleNext() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      return;
    }
    // Finished – compute score and go to result
    try {
      window.localStorage.removeItem("jlpt_quiz_state_v1");
    } catch {
      // ignore
    }
    const score = questions.reduce((acc, question, index) => {
      return acc + (answers[index] === question.correct_index ? 1 : 0);
    }, 0);
    router.push(`/quiz/result?score=${score}&total=${questions.length}`);
  }

  function handleBack() {
    if (currentIndex === 0) return;
    setCurrentIndex(currentIndex - 1);
  }

  function handleExit() {
    try {
      window.localStorage.removeItem("jlpt_quiz_state_v1");
    } catch {
      // ignore
    }
    router.push("/jlpt");
  }

  const isLast = currentIndex === questions.length - 1;
  const canGoNext = typeof selectedIndex === "number";

  return (
    <div className="bg-[#FAF8F5] py-12 sm:py-16 px-4 sm:px-6">
      <div className="max-w-[1100px] mx-auto">
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
                Question {currentIndex + 1} of {questions.length}
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
              onClick={handleNotSure}
              className="mt-4 text-sm text-secondary hover:text-primary underline-offset-2 hover:underline"
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
                onClick={handleNext}
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
                <li>10 questions • 3–5 minutes</li>
                <li>We&apos;ll recommend your JLPT level.</li>
                <li>Get the best matching bundle.</li>
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
