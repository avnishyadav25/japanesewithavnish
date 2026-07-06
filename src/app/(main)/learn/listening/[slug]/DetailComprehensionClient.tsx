"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

type Scenario = {
  id: string;
  title: string;
  audioUrl: string;
  transcript: string | null;
  sortOrder: number;
};

type Question = {
  id: string;
  questionText: string;
  options: string[];
  correctIndex: number;
  sortOrder: number;
};

interface Props {
  scenarios: Scenario[];
  sessionEmail: string | null;
}

export function DetailComprehensionClient({ scenarios, sessionEmail }: Props) {
  const [selectedScenario, setSelectedScenario] = useState<Scenario>(scenarios[0]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);

  // Load questions for selected scenario
  useEffect(() => {
    setLoadingQuestions(true);
    setAnswers({});
    setSubmitted(false);
    setShowTranscript(false);
    setStartTime(Date.now());

    fetch(`/api/learn/listening/scenarios/${selectedScenario.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const qs = Array.isArray(data?.questions) ? data.questions : [];
        setQuestions(
          qs.map((q: any) => ({
            id: q.id,
            questionText: q.questionText,
            options: Array.isArray(q.options) ? q.options : [],
            correctIndex: q.correctIndex,
            sortOrder: q.sortOrder ?? 0,
          }))
        );
      })
      .catch(() => setQuestions([]))
      .finally(() => setLoadingQuestions(false));
  }, [selectedScenario.id]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const handleSelectOption = (qId: string, idx: number) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qId]: idx }));
  };

  const handleSubmit = useCallback(() => {
    setSubmitted(true);
    const correctCount = questions.filter((q) => answers[q.id] === q.correctIndex).length;
    const responseTimeMs = startTime != null ? Date.now() - startTime : undefined;

    fetch("/api/learn/listening/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenarioId: selectedScenario.id,
        score: correctCount,
        totalQuestions: questions.length,
        responseTimeMs,
        answers,
      }),
    }).catch(() => {});
  }, [questions, answers, selectedScenario.id, startTime]);

  const correctCount = questions.filter((q) => answers[q.id] === q.correctIndex).length;

  return (
    <div className="space-y-6">
      
      {/* Scenario Selector tabs */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold text-secondary uppercase tracking-wider block">Practice Scenario:</span>
        <div className="flex flex-wrap gap-2">
          {scenarios.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedScenario(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                selectedScenario.id === s.id
                  ? "bg-[#D0021B] text-white border-[#D0021B]"
                  : "bg-white text-charcoal border-[var(--divider)] hover:border-primary/30"
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>

      {/* Main player box */}
      <div className="bg-white border border-[var(--divider)] rounded-3xl p-6 shadow-sm space-y-6">
        
        {/* Audio elements */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#FAF8F5] border border-[var(--divider)] p-4 rounded-2xl">
          <audio
            ref={audioRef}
            src={selectedScenario.audioUrl}
            controls
            className="w-full max-w-md h-9"
          />
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-bold text-secondary uppercase">Speed:</span>
            <select
              value={playbackRate}
              onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
              className="bg-white border border-[var(--divider)] rounded-lg px-2 py-1 text-xs font-bold text-charcoal focus:outline-none"
            >
              <option value="0.75">0.75x</option>
              <option value="1">1.0x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
            </select>
          </div>
        </div>

        {/* Questions list */}
        <div className="space-y-6">
          <h3 className="font-heading font-black text-sm text-charcoal uppercase tracking-wider">Practice Questions</h3>

          {loadingQuestions ? (
            <div className="py-12 flex justify-center">
              <span className="text-xs text-secondary animate-pulse">Loading comprehension items...</span>
            </div>
          ) : questions.length === 0 ? (
            <p className="text-xs text-secondary">No questions added for this scenario yet.</p>
          ) : (
            <div className="space-y-6">
              {questions.map((q, qIdx) => (
                <div key={q.id} className="space-y-3">
                  <h4 className="text-xs font-bold text-charcoal flex gap-2">
                    <span className="text-primary">{qIdx + 1}.</span>
                    <span>{q.questionText}</span>
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-4">
                    {q.options.map((opt, optIdx) => {
                      const isSelected = answers[q.id] === optIdx;
                      const isCorrect = q.correctIndex === optIdx;
                      let optionStyle = "border-[var(--divider)] bg-white text-charcoal hover:border-primary/20";
                      
                      if (submitted) {
                        if (isCorrect) optionStyle = "border-green-600 bg-green-50/50 text-green-800";
                        else if (isSelected) optionStyle = "border-red-600 bg-red-50/50 text-red-800";
                        else optionStyle = "border-[var(--divider)] bg-gray-50 text-secondary opacity-60";
                      } else if (isSelected) {
                        optionStyle = "border-[#D0021B] bg-[#FFF7F7] text-primary";
                      }

                      return (
                        <button
                          key={optIdx}
                          onClick={() => handleSelectOption(q.id, optIdx)}
                          disabled={submitted}
                          className={`w-full text-left px-4 py-2.5 rounded-xl border text-xs font-medium transition ${optionStyle}`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Action row */}
              <div className="pt-4 border-t border-[var(--divider)] flex flex-wrap items-center justify-between gap-4">
                {!submitted ? (
                  <button
                    onClick={handleSubmit}
                    disabled={Object.keys(answers).length < questions.length}
                    className="btn-primary h-11 px-6 rounded-xl text-xs font-bold font-heading flex items-center justify-center disabled:opacity-55"
                  >
                    Submit Answers
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-secondary">
                      Score: <strong className="text-charcoal">{correctCount}/{questions.length}</strong>
                    </span>
                    {correctCount === questions.length ? (
                      <span className="text-xs text-green-700 font-bold">完美! All correct!</span>
                    ) : (
                      <span className="text-xs text-[#C8A35F] font-bold">Good effort!</span>
                    )}
                  </div>
                )}

                {selectedScenario.transcript && (
                  <button
                    onClick={() => setShowTranscript((v) => !v)}
                    className="text-xs text-primary font-bold hover:underline"
                  >
                    {showTranscript ? "Hide Transcript" : "Reveal Transcript"}
                  </button>
                )}
              </div>

              {/* Transcript reveal */}
              {showTranscript && selectedScenario.transcript && (
                <div className="bg-[#FAF8F5] border border-[var(--divider)] rounded-2xl p-4 mt-4 text-xs text-charcoal leading-relaxed whitespace-pre-wrap font-mono">
                  {selectedScenario.transcript}
                </div>
              )}

            </div>
          )}
        </div>

      </div>

    </div>
  );
}
