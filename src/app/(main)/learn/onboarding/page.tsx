"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Screen = "welcome" | "manual" | "quiz" | "result";

type Question = {
  id: number;
  text: string;
  options: string[];
  answer: number; // index of correct option
};

const PLACEMENT_QUESTIONS: Question[] = [
  // N5 Questions (1 & 2)
  {
    id: 1,
    text: "[N5] Which Hiragana character represents the sound 'ko'?",
    options: ["か (ka)", "こ (ko)", "く (ku)", "け (ke)"],
    answer: 1,
  },
  {
    id: 2,
    text: "[N5] What is the meaning of the word 'これ' (kore)?",
    options: ["This", "That", "There", "Who"],
    answer: 0,
  },
  // N4 Questions (3 & 4)
  {
    id: 3,
    text: "[N4] What is the polite past tense of the verb 'taberu' (to eat)?",
    options: ["たべます (tabemasu)", "たべました (tabemashita)", "たべない (tabenai)", "たべた (tabeta)"],
    answer: 1,
  },
  {
    id: 4,
    text: "[N4] Which particle is used to mark the direct object of a verb?",
    options: ["が (ga)", "は (ha)", "を (o)", "に (ni)"],
    answer: 2,
  },
  // N3 Questions (5 & 6)
  {
    id: 5,
    text: "[N3] Translate: '日本語が少し話せます' (Nihongo ga sukoshi hanasemasu)",
    options: [
      "I speak fluent Japanese",
      "I cannot speak Japanese",
      "I can speak a little Japanese",
      "Japanese is difficult to learn"
    ],
    answer: 2,
  },
  {
    id: 6,
    text: "[N3] What does the grammar pattern '〜はずです' (hazu desu) imply?",
    options: [
      "Something is expected or should be the case",
      "Doing something is forbidden",
      "Expressing regret after making a mistake",
      "Attempting to do something new"
    ],
    answer: 0,
  },
  // N2 Questions (7 & 8)
  {
    id: 7,
    text: "[N2] Identify the correct Kanji representing 'water' (mizu):",
    options: ["木 (tree)", "火 (fire)", "水 (water)", "土 (soil)"],
    answer: 2,
  },
  {
    id: 8,
    text: "[N2] What does the grammar pattern '〜にともなって' (ni tomonatte) mean?",
    options: [
      "Instead of/in place of",
      "Along with / as a consequence of",
      "Even though/despite",
      "Only for/exclusive to"
    ],
    answer: 1,
  },
  // N1 Questions (9 & 10)
  {
    id: 9,
    text: "[N1] What is the meaning of the verb '余儀なくされる' (yogi naku sareru)?",
    options: [
      "To be highly praised for achievements",
      "To be forced to do something due to circumstances",
      "To completely forget a task",
      "To postpone a meeting"
    ],
    answer: 1,
  },
  {
    id: 10,
    text: "[N1] What does the grammar structure 'Noun + なりに' (nari ni) mean?",
    options: [
      "In one's own way / corresponding to",
      "Never do such a thing",
      "As soon as someone leaves",
      "Without doing anything else"
    ],
    answer: 0,
  },
];

const JLPT_LEVELS = [
  { code: "N5", name: "Beginner", desc: "Hiragana, Katakana, basic grammar and simple daily expressions." },
  { code: "N4", name: "Elementary", desc: "Basic daily conversations, common verbs and intermediate sentence structures." },
  { code: "N3", name: "Intermediate", desc: "Covers standard Japanese, comprehension of everyday written passages." },
  { code: "N2", name: "Upper Intermediate", desc: "Business level communications, news reading, and fast speaking speeds." },
  { code: "N1", name: "Advanced / Native", desc: "Academic and professional fluency, complex writings, and native nuances." },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("welcome");
  const [saving, setSaving] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);

  // Quiz State
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [recommendedLevel, setRecommendedLevel] = useState<string>("N5");

  const saveOnboarding = async (level: string, isQuiz = false) => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_level: level,
          onboarding_completed: true,
          placement_quiz_completed: isQuiz,
          quiz_recommended_level: isQuiz ? level : undefined,
        }),
      });
      if (res.ok) {
        router.push("/learn/curriculum");
      }
    } catch (err) {
      console.error("Save onboarding failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleSkipToN5 = () => {
    saveOnboarding("N5");
  };

  const handleSelectManualLevel = (levelCode: string) => {
    setSelectedLevel(levelCode);
  };

  const handleConfirmManualLevel = () => {
    if (selectedLevel) {
      saveOnboarding(selectedLevel);
    }
  };

  const handleQuizAnswer = (optionIdx: number) => {
    const nextAnswers = [...quizAnswers, optionIdx];
    setQuizAnswers(nextAnswers);

    if (currentQIndex < PLACEMENT_QUESTIONS.length - 1) {
      setCurrentQIndex(currentQIndex + 1);
    } else {
      // Evaluate quiz score
      let score = 0;
      PLACEMENT_QUESTIONS.forEach((q, idx) => {
        if (nextAnswers[idx] === q.answer) {
          score++;
        }
      });

      let level = "N5";
      if (score >= 9) {
        level = "N1";
      } else if (score >= 7) {
        level = "N2";
      } else if (score >= 5) {
        level = "N3";
      } else if (score >= 3) {
        level = "N4";
      }

      setRecommendedLevel(level);
      setScreen("result");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--base)] py-12 px-4 flex flex-col items-center justify-center relative overflow-hidden">
      
      {/* Background elements */}
      <div className="absolute inset-0 japanese-wave-bg opacity-30 pointer-events-none" />

      <div className="max-w-2xl w-full bg-white border border-[var(--divider)] rounded-3xl p-8 sm:p-12 shadow-card relative z-10 space-y-8">
        
        {/* Progress Dots */}
        <div className="flex justify-center gap-1.5 shrink-0">
          <div className={`h-1.5 w-10 rounded-full transition-all duration-300 ${screen === "welcome" ? "bg-[#D0021B]" : "bg-[var(--divider)]"}`} />
          <div className={`h-1.5 w-10 rounded-full transition-all duration-300 ${(screen === "manual" || screen === "quiz") ? "bg-[#D0021B]" : "bg-[var(--divider)]"}`} />
          <div className={`h-1.5 w-10 rounded-full transition-all duration-300 ${screen === "result" ? "bg-[#D0021B]" : "bg-[var(--divider)]"}`} />
        </div>

        {/* Screen 1: Welcome */}
        {screen === "welcome" && (
          <div className="space-y-6 text-center">
            <div className="space-y-3">
              <span className="text-4xl">👋</span>
              <h1 className="font-heading text-3xl font-black text-charcoal">Welcome to JapaneseWithAvnish</h1>
              <p className="text-secondary text-sm leading-relaxed max-w-md mx-auto">
                Let&apos;s personalize your roadmap. Choose how you want to select your target JLPT level to start learning.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 pt-4">
              <button
                type="button"
                onClick={handleSkipToN5}
                disabled={saving}
                className="p-6 text-left border border-[var(--divider)] hover:border-[#D0021B] rounded-2xl transition hover:shadow-sm space-y-2 group"
              >
                <div className="w-8 h-8 rounded-full bg-[#FAF8F5] group-hover:bg-[#D0021B]/5 flex items-center justify-center">
                  <span className="text-sm">🌱</span>
                </div>
                <h3 className="font-heading text-sm font-bold text-charcoal">Absolute Beginner</h3>
                <p className="text-secondary text-xs leading-normal">
                  Start from zero. We will recommend level N5 to build your foundation.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setScreen("manual")}
                className="p-6 text-left border border-[var(--divider)] hover:border-[#D0021B] rounded-2xl transition hover:shadow-sm space-y-2 group"
              >
                <div className="w-8 h-8 rounded-full bg-[#FAF8F5] group-hover:bg-[#D0021B]/5 flex items-center justify-center">
                  <span className="text-sm">🎯</span>
                </div>
                <h3 className="font-heading text-sm font-bold text-charcoal">Select Manually</h3>
                <p className="text-secondary text-xs leading-normal">
                  You already know some Japanese and want to manually select your level.
                </p>
              </button>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setScreen("quiz")}
                className="w-full py-4 bg-[#D0021B] hover:bg-[#D0021B]/95 text-white font-bold rounded-2xl transition shadow-md text-sm text-center"
              >
                Take the Placement Quiz ⚡
              </button>
              <p className="text-secondary text-[11px] mt-2.5">
                Takes only 2 minutes to evaluate your current skills.
              </p>
            </div>
          </div>
        )}

        {/* Screen 2: Manual level selection */}
        {screen === "manual" && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="font-heading text-2xl font-bold text-charcoal">Choose Your Target Level</h2>
              <p className="text-secondary text-xs">Select your current learning target level from N5 to N1.</p>
            </div>

            <div className="space-y-3">
              {JLPT_LEVELS.map((lvl) => (
                <button
                  key={lvl.code}
                  type="button"
                  onClick={() => handleSelectManualLevel(lvl.code)}
                  className={`w-full p-4 border rounded-2xl text-left flex items-start justify-between transition ${
                    selectedLevel === lvl.code
                      ? "border-[#D0021B] bg-[#D0021B]/5 ring-1 ring-[#D0021B]"
                      : "border-[var(--divider)] hover:border-[#D0021B]/50"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-heading text-sm font-bold text-charcoal">{lvl.code} {lvl.name}</span>
                    </div>
                    <p className="text-secondary text-xs leading-relaxed pr-6">{lvl.desc}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-1 ${
                    selectedLevel === lvl.code ? "border-[#D0021B] bg-[#D0021B]" : "border-[var(--divider)]"
                  }`}>
                    {selectedLevel === lvl.code && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => setScreen("welcome")}
                className="flex-1 py-3 border border-[var(--divider)] hover:bg-[#FAF8F5] text-charcoal font-semibold rounded-2xl transition text-sm text-center"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirmManualLevel}
                disabled={!selectedLevel || saving}
                className="flex-1 py-3 bg-[#D0021B] disabled:opacity-50 hover:bg-[#D0021B]/95 text-white font-bold rounded-2xl transition text-sm text-center"
              >
                Confirm Target
              </button>
            </div>
          </div>
        )}

        {/* Screen 3: Placement Quiz */}
        {screen === "quiz" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-[var(--divider)] pb-4 shrink-0">
              <span className="font-heading text-xs font-bold text-[#D0021B] uppercase tracking-wider">Placement Quiz</span>
              <span className="text-secondary text-xs">Question {currentQIndex + 1} of {PLACEMENT_QUESTIONS.length}</span>
            </div>

            <div className="space-y-6 py-2">
              <p className="text-charcoal text-base font-bold leading-relaxed">
                {PLACEMENT_QUESTIONS[currentQIndex].text}
              </p>

              <div className="grid gap-3">
                {PLACEMENT_QUESTIONS[currentQIndex].options.map((opt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleQuizAnswer(idx)}
                    className="w-full p-4 border border-[var(--divider)] hover:border-[#D0021B] hover:bg-[#D0021B]/5 rounded-2xl text-left font-semibold text-charcoal transition text-sm"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setScreen("welcome")}
                className="w-full py-3 border border-[var(--divider)] hover:bg-[#FAF8F5] text-charcoal font-semibold rounded-2xl transition text-sm text-center"
              >
                Cancel Quiz
              </button>
            </div>
          </div>
        )}

        {/* Screen 4: Quiz Result Recommendations */}
        {screen === "result" && (
          <div className="space-y-6 text-center">
            <div className="space-y-3">
              <div className="w-16 h-16 bg-[#D0021B]/5 rounded-full flex items-center justify-center mx-auto border border-[#D0021B]/10">
                <span className="text-3xl">✨</span>
              </div>
              <h2 className="font-heading text-2xl font-black text-charcoal">Recommended Level: {recommendedLevel}</h2>
              <p className="text-secondary text-sm leading-relaxed max-w-sm mx-auto">
                Based on your answers, we recommend starting from level **{recommendedLevel}** to build solid foundational skills.
              </p>
            </div>

            <div className="pt-6 flex flex-col sm:flex-row gap-4">
              <button
                type="button"
                onClick={() => setScreen("manual")}
                className="flex-1 py-3.5 border border-[var(--divider)] hover:bg-[#FAF8F5] text-charcoal font-semibold rounded-2xl transition text-sm text-center"
              >
                Choose level manually
              </button>
              <button
                type="button"
                onClick={() => saveOnboarding(recommendedLevel, true)}
                disabled={saving}
                className="flex-1 py-3.5 bg-[#D0021B] hover:bg-[#D0021B]/95 text-white font-bold rounded-2xl transition text-sm text-center shadow-md"
              >
                Accept and Start
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
