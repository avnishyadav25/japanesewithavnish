"use client";

import { useState } from "react";
import { WritingCanvas } from "../WritingCanvas";

type Practice = {
  id: string;
  title: string;
  description: string | null;
  practice_type: string | null;
  content_data: any;
  estimated_minutes: number | null;
};

type Props = {
  practices: Practice[];
  lessonTitle: string;
  lessonId: string;
  kanaList?: { character: string; romaji: string; type: string }[];
  kanjiList?: { character: string; meaning: string }[];
};

export function InteractivePracticePanel({ practices, lessonTitle, lessonId, kanaList = [], kanjiList = [] }: Props) {
  const [activePractice, setActivePractice] = useState<Practice | null>(null);
  const [completed, setCompleted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [showFeedback, setShowFeedback] = useState<Record<number, boolean>>({});
  const [score, setScore] = useState(0);

  // Audio recording state for shadowing
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSuccess, setRecordingSuccess] = useState(false);

  if (practices.length === 0) {
    return (
      <div className="bg-white border border-[var(--divider)] rounded-bento p-6 text-center">
        <p className="text-secondary text-sm italic">No interactive practices assigned to this lesson yet.</p>
      </div>
    );
  }

  // Helper to format practice type tags
  const getPracticeIcon = (type: string | null) => {
    switch (type) {
      case "writing_canvas": return "✍️";
      case "mcq": return "❓";
      case "fill_blank": return "✏️";
      case "roleplay": return "💬";
      case "listening": return "🎧";
      case "shadowing": return "🔊";
      default: return "🎯";
    }
  };

  const getPracticeTypeLabel = (type: string | null) => {
    switch (type) {
      case "writing_canvas": return "Writing Practice";
      case "mcq": return "Multiple Choice Quiz";
      case "fill_blank": return "Fill-in-the-blank";
      case "roleplay": return "Roleplay Dialogue";
      case "listening": return "Listening Practice";
      case "shadowing": return "Shadowing Drill";
      default: return "Interactive Drill";
    }
  };

  // Extract practice content or provide robust dynamic fallbacks based on type
  const getPracticeContent = (prac: Practice) => {
    const data = prac.content_data || {};
    
    // MCQ fallback
    if (prac.practice_type === "mcq") {
      if (Array.isArray(data.questions) && data.questions.length > 0) return data.questions;
      // Dynamic fallback
      return [
        {
          question: `Which of the following is correct regarding "${lessonTitle}"?`,
          options: ["Option A (Correct)", "Option B", "Option C", "Option D"],
          answer: "Option A (Correct)",
          explanation: `This is a review question for "${lessonTitle}".`,
        },
        {
          question: `True or False: The concepts introduced in this lesson are foundational.`,
          options: ["True", "False"],
          answer: "True",
          explanation: `All curriculum items are carefully ordered to build foundation step-by-step.`,
        }
      ];
    }

    // Fill blank fallback
    if (prac.practice_type === "fill_blank") {
      if (Array.isArray(data.questions) && data.questions.length > 0) return data.questions;
      return [
        {
          sentence: "日本語___おもしろいです。 (Particle indicating topic)",
          answer: "は",
          hint: "Topic marker particle",
        },
        {
          sentence: "私はアビ___です。 (Polite copula 'am')",
          answer: "です",
          hint: "Polite state of being",
        }
      ];
    }

    // Roleplay fallback
    if (prac.practice_type === "roleplay") {
      if (Array.isArray(data.turns) && data.turns.length > 0) return data.turns;
      return [
        {
          prompt: "Introduce yourself: Say 'Hello, I am [Your Name]. Nice to meet you.'",
          english: "Hello, I am [Your Name]. Nice to meet you.",
          modelAnswer: "はじめまして、アビです。どうぞよろしくおねがいします。",
        }
      ];
    }

    // Writing fallback
    if (prac.practice_type === "writing_canvas") {
      if (Array.isArray(data.characters) && data.characters.length > 0) return data.characters;
      // Fallback to characters linked in this lesson
      if (kanaList.length > 0) {
        return kanaList.map(k => ({ char: k.character, type: k.type, reading: k.romaji }));
      }
      if (kanjiList.length > 0) {
        return kanjiList.map(k => ({ char: k.character, type: "kanji", reading: k.meaning }));
      }
      return [{ char: "あ", type: "hiragana", reading: "a" }, { char: "い", type: "hiragana", reading: "i" }];
    }

    // Listening fallback
    if (prac.practice_type === "listening") {
      const audioUrl = data.audioUrl || "/audio/sample.mp3";
      const questions = Array.isArray(data.questions) ? data.questions : [
        {
          question: "What is the main topic of the conversation you heard?",
          options: ["Introducing oneself", "Ordering coffee", "Asking directions", "Telling the time"],
          answer: "Introducing oneself",
          explanation: "The speaker said 'はじめまして' (nice to meet you)."
        }
      ];
      return { audioUrl, questions };
    }

    // Shadowing fallback
    if (prac.practice_type === "shadowing") {
      return {
        audioUrl: data.audioUrl || "/audio/sample.mp3",
        textJa: data.textJa || "はじめまして、どうぞよろしくおねがいします。",
        textRomaji: data.textRomaji || "Hajimemashite, douzo yoroshiku onegaishimasu.",
        textEn: data.textEn || "Nice to meet you, please look after me.",
      };
    }

    return null;
  };

  const handleStart = (prac: Practice) => {
    setActivePractice(prac);
    setCompleted(false);
    setCurrentIndex(0);
    setUserAnswers({});
    setShowFeedback({});
    setScore(0);
    setRecordingSuccess(false);
  };

  const handleMCQSubmit = (option: string, answer: string) => {
    if (showFeedback[currentIndex]) return;
    setUserAnswers(prev => ({ ...prev, [currentIndex]: option }));
    setShowFeedback(prev => ({ ...prev, [currentIndex]: true }));
    if (option === answer) {
      setScore(prev => prev + 1);
    }
  };

  const handleFillBlankSubmit = (typed: string, answer: string) => {
    if (showFeedback[currentIndex]) return;
    setUserAnswers(prev => ({ ...prev, [currentIndex]: typed }));
    setShowFeedback(prev => ({ ...prev, [currentIndex]: true }));
    if (typed.trim().toLowerCase() === answer.trim().toLowerCase()) {
      setScore(prev => prev + 1);
    }
  };

  const handleNext = (totalLength: number) => {
    if (currentIndex < totalLength - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCompleted(true);
    }
  };

  const handleShadowingRecord = () => {
    if (isRecording) {
      setIsRecording(false);
      setRecordingSuccess(true);
    } else {
      setIsRecording(true);
      setRecordingSuccess(false);
    }
  };

  return (
    <div className="space-y-6">
      {activePractice === null ? (
        // Practice selection grid
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {practices.map((p) => (
            <button
              key={p.id}
              onClick={() => handleStart(p)}
              className="bg-white border border-[var(--divider)] rounded-bento p-5 text-left hover:border-primary hover:shadow-md transition duration-200 flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl" aria-hidden>{getPracticeIcon(p.practice_type)}</span>
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wide">
                    {getPracticeTypeLabel(p.practice_type)}
                  </span>
                  {p.estimated_minutes && (
                    <span className="text-[10px] bg-charcoal/5 px-2 py-0.5 rounded-full text-secondary">
                      ⏱ {p.estimated_minutes} min
                    </span>
                  )}
                </div>
                <h4 className="font-heading font-bold text-charcoal text-base group-hover:text-primary transition duration-150">
                  {p.title}
                </h4>
                {p.description && (
                  <p className="text-secondary text-xs mt-1.5 leading-relaxed line-clamp-2">
                    {p.description}
                  </p>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--divider)]/40 w-full flex items-center justify-between text-xs font-semibold text-primary">
                <span>Start Practice</span>
                <span className="group-hover:translate-x-1 transition-transform duration-150">→</span>
              </div>
            </button>
          ))}
        </div>
      ) : completed ? (
        // Completed Screen
        <div className="bg-white border border-[var(--divider)] rounded-bento p-8 text-center max-w-lg mx-auto shadow-sm">
          <span className="text-5xl block mb-4">🏆</span>
          <h3 className="font-heading text-xl font-bold text-charcoal mb-2">Practice Complete!</h3>
          <p className="text-secondary text-sm mb-6">
            Congratulations! You completed the practice drill: <br />
            <strong className="text-charcoal font-semibold">{activePractice.title}</strong>
          </p>

          {activePractice.practice_type === "mcq" || activePractice.practice_type === "fill_blank" ? (
            <div className="bg-primary/5 rounded-xl p-4 mb-6 border border-primary/10">
              <span className="text-xs text-secondary font-medium">Your Score</span>
              <p className="font-heading font-black text-3xl text-primary mt-1">
                {score} / {getPracticeContent(activePractice).length}
              </p>
            </div>
          ) : null}

          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              onClick={() => handleStart(activePractice)}
              className="px-5 py-2.5 bg-primary/10 text-primary font-bold text-sm rounded-xl hover:bg-primary/15 transition"
            >
              🔄 Retry Drill
            </button>
            <button
              onClick={() => setActivePractice(null)}
              className="px-5 py-2.5 bg-primary text-white font-bold text-sm rounded-xl hover:bg-primary/95 transition shadow-sm"
            >
              ← Back to list
            </button>
          </div>
        </div>
      ) : (
        // Active Drill Screen
        <div className="bg-white border border-[var(--divider)] rounded-bento p-6 shadow-xs relative">
          <div className="flex items-center justify-between border-b border-[var(--divider)]/50 pb-3 mb-5">
            <div>
              <span className="text-xs font-bold text-primary uppercase tracking-wide">
                {getPracticeTypeLabel(activePractice.practice_type)}
              </span>
              <h3 className="font-heading font-bold text-charcoal text-base">{activePractice.title}</h3>
            </div>
            <button
              onClick={() => setActivePractice(null)}
              className="text-secondary hover:text-charcoal text-xs font-semibold px-2 py-1 rounded hover:bg-gray-100 transition"
            >
              Exit ✕
            </button>
          </div>

          {/* 1. Multiple Choice Quiz (MCQ) */}
          {activePractice.practice_type === "mcq" && (() => {
            const list = getPracticeContent(activePractice);
            const q = list[currentIndex];
            const chosen = userAnswers[currentIndex];
            const revealed = showFeedback[currentIndex];

            return (
              <div className="space-y-4">
                <span className="text-xs text-secondary font-medium block">
                  Question {currentIndex + 1} of {list.length}
                </span>
                <h4 className="font-heading font-bold text-charcoal text-lg mb-4">{q.question}</h4>

                <div className="grid grid-cols-1 gap-2.5">
                  {q.options.map((opt: string) => {
                    const isCorrect = opt === q.answer;
                    const isSelected = chosen === opt;
                    let btnClass = "border-[var(--divider)] hover:border-primary hover:bg-primary/5";
                    if (revealed) {
                      if (isCorrect) btnClass = "border-green-500 bg-green-50 text-green-700 font-semibold";
                      else if (isSelected) btnClass = "border-red-500 bg-red-50 text-red-700";
                      else btnClass = "border-[var(--divider)] opacity-60 pointer-events-none";
                    }

                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleMCQSubmit(opt, q.answer)}
                        disabled={revealed}
                        className={`w-full px-4 py-3 border rounded-xl text-left text-sm transition duration-150 ${btnClass}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {revealed && (
                  <div className="mt-4 p-4 rounded-xl bg-[#FAF8F5] border border-[var(--divider)]/60 text-sm animate-scaleUp">
                    <p className="font-bold text-charcoal mb-1">
                      {chosen === q.answer ? "🎉 Correct!" : "❌ Incorrect"}
                    </p>
                    <p className="text-secondary leading-relaxed">{q.explanation}</p>
                    <button
                      onClick={() => handleNext(list.length)}
                      className="mt-4 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/95 transition shadow-sm"
                    >
                      {currentIndex === list.length - 1 ? "Finish" : "Next Question →"}
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* 2. Fill-in-the-blank */}
          {activePractice.practice_type === "fill_blank" && (() => {
            const list = getPracticeContent(activePractice);
            const q = list[currentIndex];
            const submitted = showFeedback[currentIndex];
            const val = userAnswers[currentIndex] || "";

            return (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const target = e.currentTarget.elements.namedItem("blankInput") as HTMLInputElement;
                  handleFillBlankSubmit(target.value, q.answer);
                }}
                className="space-y-4"
              >
                <span className="text-xs text-secondary font-medium block">
                  Question {currentIndex + 1} of {list.length}
                </span>
                
                <div className="bg-[#FAF8F5] border border-[var(--divider)] p-5 rounded-2xl text-center mb-4">
                  <p className="font-heading font-bold text-charcoal text-xl tracking-wide">{q.sentence}</p>
                </div>

                <div className="flex gap-2 max-w-md mx-auto">
                  <input
                    name="blankInput"
                    type="text"
                    required
                    disabled={submitted}
                    defaultValue={val}
                    placeholder={q.hint ? `Hint: ${q.hint}` : "Type answer..."}
                    className="flex-1 px-4 py-2.5 border border-[var(--divider)] rounded-xl text-sm focus:border-primary"
                  />
                  <button
                    type="submit"
                    disabled={submitted}
                    className="px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/95 transition disabled:opacity-65 shadow-xs"
                  >
                    Check
                  </button>
                </div>

                {submitted && (
                  <div className="mt-4 p-4 rounded-xl bg-[#FAF8F5] border border-[var(--divider)]/60 text-sm max-w-md mx-auto text-center animate-scaleUp">
                    <p className="font-bold mb-1">
                      {val.trim().toLowerCase() === q.answer.trim().toLowerCase() ? "🎉 Correct!" : "❌ Incorrect"}
                    </p>
                    <p className="text-secondary">
                      Correct Answer: <strong className="text-charcoal font-semibold">{q.answer}</strong>
                    </p>
                    <button
                      type="button"
                      onClick={() => handleNext(list.length)}
                      className="mt-4 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/95 transition shadow-sm inline-block"
                    >
                      {currentIndex === list.length - 1 ? "Finish" : "Next →"}
                    </button>
                  </div>
                )}
              </form>
            );
          })()}

          {/* 3. Roleplay Dialogue */}
          {activePractice.practice_type === "roleplay" && (() => {
            const list = getPracticeContent(activePractice);
            const q = list[currentIndex];
            const submitted = showFeedback[currentIndex];
            const val = userAnswers[currentIndex] || "";

            return (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const target = e.currentTarget.elements.namedItem("roleplayInput") as HTMLTextAreaElement;
                  setUserAnswers(prev => ({ ...prev, [currentIndex]: target.value }));
                  setShowFeedback(prev => ({ ...prev, [currentIndex]: true }));
                }}
                className="space-y-4"
              >
                <span className="text-xs text-secondary font-medium block">
                  Scenario {currentIndex + 1} of {list.length}
                </span>

                <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl mb-4 text-center">
                  <span className="text-xs text-secondary font-semibold uppercase block mb-1">Prompt</span>
                  <p className="font-heading font-bold text-charcoal text-base">{q.prompt}</p>
                  {q.english && <p className="text-xs text-secondary mt-1">({q.english})</p>}
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-medium text-charcoal">Your response (Write in Japanese):</label>
                  <textarea
                    name="roleplayInput"
                    required
                    disabled={submitted}
                    rows={3}
                    defaultValue={val}
                    placeholder="Type your response here..."
                    className="w-full px-4 py-2.5 border border-[var(--divider)] rounded-xl text-sm focus:border-primary bg-white"
                  />
                </div>

                {!submitted ? (
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/95 transition shadow-sm"
                  >
                    Submit Response
                  </button>
                ) : (
                  <div className="mt-4 p-4 rounded-xl bg-[#FAF8F5] border border-[var(--divider)]/60 text-sm space-y-3 animate-scaleUp">
                    <div>
                      <span className="text-xs text-secondary block font-semibold">Your Answer</span>
                      <p className="text-charcoal font-medium mt-0.5">{val}</p>
                    </div>
                    <div className="border-t border-[var(--divider)]/50 pt-2.5">
                      <span className="text-xs text-secondary block font-semibold">Model Suggestion</span>
                      <p className="text-green-700 font-bold mt-0.5">{q.modelAnswer}</p>
                    </div>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => handleNext(list.length)}
                        className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/95 transition shadow-sm"
                      >
                        {currentIndex === list.length - 1 ? "Finish" : "Next Scenario →"}
                      </button>
                    </div>
                  </div>
                )}
              </form>
            );
          })()}

          {/* 4. Writing Trace Canvas */}
          {activePractice.practice_type === "writing_canvas" && (() => {
            const list = getPracticeContent(activePractice);
            const item = list[currentIndex];

            return (
              <div className="space-y-4 max-w-sm mx-auto flex flex-col items-center">
                <span className="text-xs text-secondary font-medium block w-full text-left">
                  Character {currentIndex + 1} of {list.length}
                </span>

                <div className="text-center mb-2">
                  <h4 className="text-xs text-secondary uppercase font-semibold">Draw this character</h4>
                  <p className="font-heading font-black text-3xl text-charcoal mt-1">{item.char}</p>
                  {item.reading && <p className="text-sm text-primary font-medium mt-0.5">({item.reading})</p>}
                </div>

                <div className="w-[240px] h-[240px] border border-[var(--divider)] rounded-2xl overflow-hidden bg-white shadow-inner flex items-center justify-center">
                  <WritingCanvas
                    key={`${currentIndex}-${item.char}`}
                    character={item.char}
                    characterType={item.type === "kanji" ? "kanji" : item.type === "katakana" ? "katakana" : "hiragana"}
                    reading={item.reading}
                    onVerify={() => {}}
                    className="w-full h-full"
                  />
                </div>

                <div className="flex gap-2 w-full mt-4 justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      // Trigger a redraw / clear by hitting verification or reset
                      // We clear inside canvas state. Clicking next is sufficient.
                      handleNext(list.length);
                    }}
                    className="px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/95 transition shadow-sm w-full"
                  >
                    {currentIndex === list.length - 1 ? "Complete" : "Next Character →"}
                  </button>
                </div>
              </div>
            );
          })()}

          {/* 5. Listening Drill */}
          {activePractice.practice_type === "listening" && (() => {
            const payload = getPracticeContent(activePractice);
            const q = payload.questions[currentIndex];
            const chosen = userAnswers[currentIndex];
            const revealed = showFeedback[currentIndex];

            return (
              <div className="space-y-4">
                <div className="bg-[#FAF8F5] border border-[var(--divider)] p-4 rounded-2xl flex flex-col items-center gap-3">
                  <span className="text-xs text-secondary font-semibold uppercase block">Audio Playback</span>
                  <audio src={payload.audioUrl} controls className="w-full max-w-md" />
                </div>

                <span className="text-xs text-secondary font-medium block">
                  Question {currentIndex + 1} of {payload.questions.length}
                </span>
                <h4 className="font-heading font-bold text-charcoal text-base mb-3">{q.question}</h4>

                <div className="grid grid-cols-1 gap-2">
                  {q.options.map((opt: string) => {
                    const isCorrect = opt === q.answer;
                    const isSelected = chosen === opt;
                    let btnClass = "border-[var(--divider)] hover:border-primary hover:bg-primary/5 bg-white";
                    if (revealed) {
                      if (isCorrect) btnClass = "border-green-500 bg-green-50 text-green-700 font-semibold";
                      else if (isSelected) btnClass = "border-red-500 bg-red-50 text-red-700";
                      else btnClass = "border-[var(--divider)] opacity-60 pointer-events-none";
                    }

                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          if (revealed) return;
                          setUserAnswers(prev => ({ ...prev, [currentIndex]: opt }));
                          setShowFeedback(prev => ({ ...prev, [currentIndex]: true }));
                          if (opt === q.answer) setScore(prev => prev + 1);
                        }}
                        disabled={revealed}
                        className={`w-full px-4 py-2.5 border rounded-xl text-left text-sm transition duration-155 ${btnClass}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {revealed && (
                  <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[var(--divider)]/60 text-sm animate-scaleUp">
                    <p className="font-bold text-charcoal mb-1">
                      {chosen === q.answer ? "🎉 Correct!" : "❌ Incorrect"}
                    </p>
                    <p className="text-secondary leading-relaxed">{q.explanation}</p>
                    <button
                      onClick={() => handleNext(payload.questions.length)}
                      className="mt-4 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/95 transition shadow-sm"
                    >
                      {currentIndex === payload.questions.length - 1 ? "Finish" : "Next Question →"}
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* 6. Shadowing Drill */}
          {activePractice.practice_type === "shadowing" && (() => {
            const item = getPracticeContent(activePractice);

            return (
              <div className="space-y-5 text-center">
                <div className="bg-[#FAF8F5] border border-[var(--divider)] p-4 rounded-2xl flex flex-col items-center gap-3">
                  <span className="text-xs text-secondary font-semibold uppercase block">Listen & Repeat</span>
                  <audio src={item.audioUrl} controls className="w-full max-w-md" />
                </div>

                <div className="space-y-2 p-5 bg-primary/5 rounded-2xl border border-primary/10">
                  <span className="text-[10px] text-primary font-bold uppercase tracking-wide block">Shadow Text</span>
                  <p className="font-heading font-bold text-2xl text-charcoal leading-relaxed">{item.textJa}</p>
                  <p className="text-xs text-secondary italic font-mono">{item.textRomaji}</p>
                  <p className="text-sm text-secondary font-medium mt-1">"{item.textEn}"</p>
                </div>

                <div className="flex flex-col items-center gap-3 pt-3 border-t border-[var(--divider)]/50">
                  <button
                    type="button"
                    onClick={handleShadowingRecord}
                    className={`w-20 h-20 rounded-full flex flex-col items-center justify-center gap-1 shadow-md transition duration-200 ${
                      isRecording
                        ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
                        : "bg-white border-2 border-primary hover:bg-primary/5 text-primary"
                    }`}
                  >
                    <span className="text-2xl">{isRecording ? "⏹" : "🎤"}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">{isRecording ? "Stop" : "Record"}</span>
                  </button>
                  <span className="text-xs text-secondary">
                    {isRecording ? "Recording your voice..." : "Click record and shadow the native speaker's audio."}
                  </span>
                </div>

                {recordingSuccess && (
                  <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-sm inline-block mx-auto animate-scaleUp">
                    <p className="text-green-800 font-bold mb-1">🎙 Shadowing Recorded!</p>
                    <p className="text-green-700 text-xs mb-3">Compare your intonation and rhythm directly with the speaker.</p>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => {
                          setCompleted(true);
                        }}
                        className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/95 transition shadow-sm"
                      >
                        Finish Drill
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
