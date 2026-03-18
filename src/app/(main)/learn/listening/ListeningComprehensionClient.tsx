"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Scenario = { id: string; title: string; audioUrl: string; transcript: string | null; sortOrder: number };
type Question = { id: string; questionText: string; options: string[]; correctIndex: number; sortOrder: number };

export function ListeningComprehensionClient() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selected, setSelected] = useState<Scenario | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    fetch("/api/learn/listening/scenarios")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data.scenarios) ? data.scenarios : [];
        setScenarios(list.map((s: { id: string; title: string; audioUrl: string; transcript: string | null; sortOrder: number }) => ({
          id: s.id,
          title: s.title,
          audioUrl: s.audioUrl,
          transcript: s.transcript ?? null,
          sortOrder: s.sortOrder ?? 0,
        })));
        if (list[0]) setSelected(list[0]);
      })
      .catch(() => setScenarios([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) {
      setQuestions([]);
      return;
    }
    setAnswers({});
    setSubmitted(false);
    setShowTranscript(false);
    setStartTime(Date.now());
    fetch(`/api/learn/listening/scenarios/${selected.id}`)
      .then((r) => r.json())
      .then((data) => {
        const qs = Array.isArray(data.questions) ? data.questions : [];
        setQuestions(qs.map((q: { id: string; questionText: string; options: string[]; correctIndex: number; sortOrder: number }) => ({
          id: q.id,
          questionText: q.questionText,
          options: Array.isArray(q.options) ? q.options : [],
          correctIndex: q.correctIndex,
          sortOrder: q.sortOrder ?? 0,
        })));
      })
      .catch(() => setQuestions([]));
  }, [selected?.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = playbackRate;
  }, [playbackRate]);

  const handleSubmit = useCallback(() => {
    setSubmitted(true);
    const correct = questions.filter((q) => answers[q.id] === q.correctIndex).length;
    const responseTimeMs = startTime != null ? Date.now() - startTime : undefined;
    fetch("/api/learn/listening/attempts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenarioId: selected?.id,
        score: correct,
        totalQuestions: questions.length,
        responseTimeMs: responseTimeMs ?? undefined,
        answers,
      }),
    }).catch(() => {});
  }, [questions, answers, selected?.id, startTime]);

  if (loading) return <p className="text-secondary text-sm">Loading…</p>;

  if (scenarios.length === 0) {
    return (
      <div className="rounded-bento border border-[var(--divider)] bg-white p-6 text-center text-secondary">
        <p>No listening scenarios yet. Add scenarios and questions in admin to practice.</p>
      </div>
    );
  }

  const correctCount = questions.filter((q) => answers[q.id] === q.correctIndex).length;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-secondary mb-2">Choose a scenario:</p>
        <div className="flex flex-wrap gap-2">
          {scenarios.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelected(s)}
              className={`px-3 py-1.5 rounded-bento text-sm ${selected?.id === s.id ? "bg-primary text-white" : "border border-[var(--divider)] hover:bg-[var(--divider)]/20"}`}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className="rounded-bento border border-[var(--divider)] bg-white p-4 space-y-4">
          <h2 className="font-heading font-semibold text-charcoal">{selected.title}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <audio
              ref={audioRef}
              controls
              src={selected.audioUrl}
              preload="metadata"
              className="max-w-full"
            />
            <label className="flex items-center gap-2 text-sm">
              <span className="text-secondary">Speed:</span>
              <select
                value={playbackRate}
                onChange={(e) => setPlaybackRate(Number(e.target.value))}
                className="border border-[var(--divider)] rounded-bento px-2 py-1"
              >
                {[0.5, 0.75, 1, 1.25, 1.5].map((r) => (
                  <option key={r} value={r}>{r}x</option>
                ))}
              </select>
            </label>
          </div>

          {questions.length > 0 && (
            <div className="space-y-4">
              {questions.map((q) => (
                <div key={q.id}>
                  <p className="font-medium text-charcoal mb-2">{q.questionText}</p>
                  <ul className="space-y-1">
                    {q.options.map((opt, idx) => (
                      <li key={idx}>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name={q.id}
                            checked={answers[q.id] === idx}
                            onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: idx }))}
                            disabled={submitted}
                            className="rounded"
                          />
                          <span className={submitted && idx === q.correctIndex ? "text-green-600 font-medium" : submitted && answers[q.id] === idx && idx !== q.correctIndex ? "text-primary" : ""}>
                            {opt}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {!submitted ? (
                <button type="button" onClick={handleSubmit} className="btn-primary py-2 px-4">
                  Submit answers
                </button>
              ) : (
                <p className="text-sm font-medium text-charcoal">
                  Score: {correctCount} / {questions.length}
                </p>
              )}
            </div>
          )}

          {selected.transcript && (
            <details className="text-sm" open={showTranscript}>
              <summary
                className="cursor-pointer text-primary font-medium"
                onClick={(e) => { e.preventDefault(); setShowTranscript((v) => !v); }}
              >
                {showTranscript ? "Hide transcript" : "Reveal transcript"}
              </summary>
              <p className="mt-2 text-charcoal whitespace-pre-wrap">{selected.transcript}</p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
