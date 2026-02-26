"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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
          setQuestions(data.questions.slice(0, 15));
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

  if (loading) {
    return (
      <div className="py-24 px-4 text-center">
        <p className="text-secondary">Loading quiz...</p>
      </div>
    );
  }

  const q = questions[currentIndex];
  if (!q) {
    return (
      <div className="py-24 px-4 text-center">
        <p className="text-secondary">No questions available.</p>
      </div>
    );
  }

  const options = Array.isArray(q.options) ? q.options : [];

  function handleAnswer(optionIndex: number) {
    const next = { ...answers, [currentIndex]: optionIndex };
    setAnswers(next);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      const score = Object.entries(next).filter(
        ([i, a]) => questions[parseInt(i)]?.correct_index === a
      ).length;
      router.push(`/quiz/result?score=${score}&total=${questions.length}`);
    }
  }

  return (
    <div className="py-16 px-4 sm:px-6">
      <div className="max-w-[600px] mx-auto">
        <p className="text-secondary text-sm mb-4">
          Question {currentIndex + 1} of {questions.length}
        </p>
        <h2 className="text-xl font-bold text-charcoal mb-8">{q.question_text}</h2>
        <ul className="space-y-3">
          {options.map((opt, i) => (
            <li key={i}>
              <button
                onClick={() => handleAnswer(i)}
                className="w-full text-left px-4 py-3 rounded-card border border-[var(--divider)] hover:border-primary hover:bg-[#FFF7F7] transition"
              >
                {opt}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
