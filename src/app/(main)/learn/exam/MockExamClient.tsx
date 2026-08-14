"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Level = { id: string; code: string; name: string };
type Question = { id: string; questionText: string; options: string[]; correctIndex: number };

export function MockExamClient({ levels }: { levels: Level[] }) {
  const [levelId, setLevelId] = useState<string | null>(null);
  const [exam, setExam] = useState<{
    title: string;
    durationMinutes: number;
    questions: Question[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ score: number; total: number; passed: boolean } | null>(null);

  const loadExam = useCallback(() => {
    if (!levelId) return;
    setLoading(true);
    fetch(`/api/learn/exam/definition?levelId=${encodeURIComponent(levelId)}`)
      .then((r) => r.json())
      .then((d) => {
        setExam({
          title: d.title ?? "Mock Exam",
          durationMinutes: d.durationMinutes ?? 15,
          questions: Array.isArray(d.questions) ? d.questions : [],
        });
        setTimeLeftSeconds((d.durationMinutes ?? 15) * 60);
        setStarted(false);
        setAnswers({});
        setSubmitted(false);
        setResult(null);
      })
      .catch(() => setExam(null))
      .finally(() => setLoading(false));
  }, [levelId]);

  useEffect(() => {
    loadExam();
  }, [loadExam]);

  const answersRef = useRef(answers);
  answersRef.current = answers;
  const handleSubmit = useCallback(() => {
    if (!exam || submitted) return;
    setSubmitted(true);
    const currentAnswers = answersRef.current;
    const total = exam.questions.length;
    const score = exam.questions.filter((q) => currentAnswers[q.id] === q.correctIndex).length;
    const passed = total > 0 && score / total >= 0.6;
    setResult({ score, total, passed });
    fetch("/api/learn/exam/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exam_type: "mock",
        level_id: levelId,
        module_id: null,
        score,
        section_scores: {},
        passed,
      }),
    }).catch(() => {});
  }, [exam, submitted, levelId]);
  const handleSubmitRef = useRef(handleSubmit);
  handleSubmitRef.current = handleSubmit;
  useEffect(() => {
    if (!started || submitted || timeLeftSeconds <= 0) return;
    const t = setInterval(() => {
      setTimeLeftSeconds((s) => {
        if (s <= 1) {
          clearInterval(t);
          handleSubmitRef.current();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [started, submitted]);

  if (levels.length === 0) return <p className="text-secondary text-sm">No levels configured.</p>;

  if (!levelId) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-secondary">Choose a level:</p>
        <div className="flex flex-wrap gap-2">
          {levels.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLevelId(l.id)}
              className="px-4 py-2 rounded-bento border border-[var(--divider)] hover:bg-[var(--divider)]/20 font-medium"
            >
              {l.code} — {l.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (loading) return <p className="text-secondary text-sm">Loading…</p>;
  if (!exam) return <p className="text-secondary text-sm">Could not load exam. <button type="button" onClick={() => setLevelId(null)} className="text-primary underline">Back</button></p>;

  if (result) {
    return (
      <div className="rounded-bento border border-[var(--divider)] bg-white p-6 text-center">
        <h2 className="font-heading text-xl font-semibold text-charcoal mb-2">Result</h2>
        <p className="text-charcoal">{result.score} / {result.total} — {result.passed ? "Passed" : "Not passed"}</p>
        <button type="button" onClick={() => { setLevelId(null); setExam(null); setResult(null); }} className="mt-4 btn-primary">
          Choose another level
        </button>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="rounded-bento border border-[var(--divider)] bg-white p-6 space-y-4">
        <h2 className="font-heading text-xl font-semibold text-charcoal">{exam.title}</h2>
        <p className="text-secondary text-sm">{exam.questions.length} questions · {exam.durationMinutes} minutes</p>
        <p className="text-sm text-charcoal">When you start, a countdown will run. Submit before time runs out (honor system).</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setStarted(true)} className="btn-primary">Start exam</button>
          <Link href="/learn/dashboard" className="px-4 py-2 border border-[var(--divider)] rounded-bento text-sm">Cancel</Link>
        </div>
      </div>
    );
  }

  const m = Math.floor(timeLeftSeconds / 60);
  const s = timeLeftSeconds % 60;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center rounded-bento border border-[var(--divider)] bg-white px-4 py-2">
        <span className="font-medium text-charcoal">{exam.title}</span>
        <span className="text-primary font-mono">Time: {m}:{s.toString().padStart(2, "0")}</span>
      </div>
      <div className="space-y-6">
        {exam.questions.map((q, i) => (
          <div key={q.id} className="rounded-bento border border-[var(--divider)] bg-white p-4">
            <p className="font-medium text-charcoal mb-2">{i + 1}. {q.questionText}</p>
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
        ))}
      </div>
      <button type="button" onClick={handleSubmit} className="btn-primary w-full py-3">
        Submit exam
      </button>
    </div>
  );
}
