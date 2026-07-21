"use client";

import { useState } from "react";

const LEVELS = ["N5", "N4", "N3", "N2", "N1"];

const DEFAULT_COUNTS: Record<"full" | "mini", Record<string, number>> = {
  full: { vocabulary: 3, grammar: 3, reading: 2, listening: 2 },
  mini: { vocabulary: 1, grammar: 1, reading: 1, listening: 1 },
};

const FAMILY_LABELS: Record<string, string> = {
  vocabulary: "Vocabulary (per item type)",
  grammar: "Grammar (per item type)",
  reading: "Reading (per passage)",
  listening: "Listening (per item type)",
};

type JobStatus = {
  jobId: string;
  status: "running" | "completed" | "failed";
  stepIndex: number;
  totalSteps: number;
  log: string[];
  resultPostId: string | null;
  resultPostSlug: string | null;
  errorMessage: string | null;
};

/**
 * AI mock-test generator — creates a job then polls /generate/[jobId]/step in a loop, each call
 * advancing exactly one generation step (one LLM call). Deliberately NOT a single blocking
 * request: a full test's ~16 LLM calls + TTS fetches would exceed a serverless function's
 * request timeout in one shot, so progress happens one small round trip at a time instead.
 *
 * mode="new": creates a brand-new practice_test post (level/variant fully selectable).
 * mode="append": generates additional sections into an already-open post (level/variant inherit
 * from that post, shown read-only — a test shouldn't suddenly gain N1 vocabulary mid-N5-test).
 */
export function GenerateMockTestModal({
  mode,
  targetPostId,
  fixedLevel,
  onClose,
  onComplete,
}: {
  mode: "new" | "append";
  targetPostId?: string;
  fixedLevel?: string | null;
  onClose: () => void;
  onComplete: (resultPostId: string, resultPostSlug: string) => void;
}) {
  const [level, setLevel] = useState(fixedLevel?.toUpperCase() && LEVELS.includes(fixedLevel.toUpperCase()) ? fixedLevel.toUpperCase() : "N5");
  const [variant, setVariant] = useState<"full" | "mini">("full");
  const [counts, setCounts] = useState<Record<string, number>>(DEFAULT_COUNTS.full);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  function handleVariantChange(next: "full" | "mini") {
    setVariant(next);
    setCounts(DEFAULT_COUNTS[next]);
  }

  async function pollUntilDone(jobId: string, totalSteps: number) {
    let current: JobStatus = {
      jobId,
      status: "running",
      stepIndex: 0,
      totalSteps,
      log: [],
      resultPostId: null,
      resultPostSlug: null,
      errorMessage: null,
    };
    setJob(current);
    while (current.status === "running") {
      await new Promise((r) => setTimeout(r, 700));
      const res = await fetch(`/api/admin/practice-tests/generate/${jobId}/step`, { method: "POST" });
      if (!res.ok) {
        setJob((prev) => (prev ? { ...prev, status: "failed", errorMessage: "Step request failed" } : prev));
        return;
      }
      current = await res.json();
      setJob(current);
    }
    if (current.status === "completed" && current.resultPostId && current.resultPostSlug) {
      onComplete(current.resultPostId, current.resultPostSlug);
    }
  }

  async function handleGenerate() {
    setStarting(true);
    setStartError(null);
    try {
      const res = await fetch("/api/admin/practice-tests/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level,
          variant,
          questionCounts: counts,
          targetPostId: mode === "append" ? targetPostId : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStartError(data.error || "Failed to start generation");
        setStarting(false);
        return;
      }
      await pollUntilDone(data.jobId, data.totalSteps);
    } catch {
      setStartError("Failed to start generation");
    } finally {
      setStarting(false);
    }
  }

  const isRunning = job?.status === "running" || starting;
  const progressPct = job ? Math.round((job.stepIndex / Math.max(job.totalSteps, 1)) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="p-5 border-b border-[var(--divider)] flex items-center justify-between">
          <h2 className="font-heading font-bold text-charcoal text-sm">
            {mode === "new" ? "Generate mock test with AI" : "Generate more sections with AI"}
          </h2>
          <button type="button" onClick={onClose} disabled={isRunning} className="text-secondary hover:text-charcoal text-lg leading-none disabled:opacity-30">
            ×
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!job && (
            <>
              <p className="text-xs text-secondary">
                Generates a platform-designed JLPT-style mock test using AI — lands as a <strong>draft</strong>, review before publishing.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-secondary mb-1">Level</label>
                  {mode === "append" ? (
                    <input type="text" value={level} disabled className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm bg-[var(--base)] text-secondary" />
                  ) : (
                    <select value={level} onChange={(e) => setLevel(e.target.value)} className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm bg-white">
                      {LEVELS.map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-secondary mb-1">Format</label>
                  <select
                    value={variant}
                    onChange={(e) => handleVariantChange(e.target.value as "full" | "mini")}
                    className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm bg-white"
                  >
                    <option value="full">Full mock</option>
                    <option value="mini">Mini mock</option>
                  </select>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-secondary mb-2">Question counts</p>
                <div className="grid grid-cols-2 gap-3">
                  {Object.keys(FAMILY_LABELS).map((family) => (
                    <div key={family}>
                      <label className="block text-[10px] text-secondary mb-1">{FAMILY_LABELS[family]}</label>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={counts[family] ?? 1}
                        onChange={(e) => setCounts((prev) => ({ ...prev, [family]: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                        className="w-full px-3 py-1.5 border border-[var(--divider)] rounded-bento text-sm bg-white"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {startError && <p className="text-xs text-red-600">{startError}</p>}

              <button type="button" onClick={handleGenerate} disabled={starting} className="btn-primary w-full py-2.5 text-sm font-bold disabled:opacity-60">
                {starting ? "Starting…" : "Generate"}
              </button>
            </>
          )}

          {job && (
            <div className="space-y-3">
              <div className="h-2 rounded-full bg-[var(--divider)]/40 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${job.status === "failed" ? "bg-red-500" : "bg-primary"}`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-xs text-secondary">
                {job.status === "completed"
                  ? "Done"
                  : job.status === "failed"
                    ? "Failed"
                    : `Step ${job.stepIndex} / ${job.totalSteps}`}
              </p>

              <div className="bg-[var(--base)] border border-[var(--divider)] rounded-bento p-3 max-h-48 overflow-y-auto space-y-1">
                {job.log.map((line, i) => (
                  <p key={i} className="text-[11px] text-charcoal">{line}</p>
                ))}
              </div>

              {job.status === "failed" && (
                <p className="text-xs text-red-600">{job.errorMessage || "Generation failed."}</p>
              )}
              {job.status === "completed" && (
                <p className="text-xs text-emerald-700 font-semibold">
                  {mode === "new" ? "Mock test created as a draft." : "Sections added."}
                </p>
              )}

              {job.status !== "running" && (
                <button type="button" onClick={onClose} className="w-full py-2 text-sm font-semibold rounded-xl border border-[var(--divider)] hover:bg-[var(--base)] transition">
                  Close
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
