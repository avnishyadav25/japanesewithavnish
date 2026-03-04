"use client";

import { useState, useImperativeHandle, forwardRef, useCallback } from "react";
import { AdminCard } from "@/components/admin/AdminCard";

const LEVELS = ["all", "n5", "n4", "n3", "n2", "n1"] as const;

interface LearnRecommendedFormProps {
  initial: Record<string, string[]>;
  levelLabels: Record<string, string>;
}

export type LearnRecommendedFormRef = { pullFromDb: () => Promise<void> };

export const LearnRecommendedForm = forwardRef<LearnRecommendedFormRef, LearnRecommendedFormProps>(
  function LearnRecommendedForm({ initial, levelLabels }, ref) {
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "ok">("idle");
  const [pullStatus, setPullStatus] = useState<"idle" | "loading" | "error" | "ok">("idle");
  const [values, setValues] = useState<Record<string, string[]>>(initial);

  const update = (level: string, slugs: string[]) => {
    setValues((v) => ({ ...v, [level]: slugs }));
  };

  const setRaw = (level: string, raw: string) => {
    const slugs = raw
      .split(/[\n,]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    update(level, slugs);
  };

  const getRaw = (level: string) => (values[level] || []).join(", ");

  const handlePullFromDb = useCallback(async () => {
    setPullStatus("loading");
    try {
      const res = await fetch("/api/admin/learn-recommended-defaults");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = (await res.json()) as Record<string, string[]>;
      const next: Record<string, string[]> = {};
      for (const level of LEVELS) {
        next[level] = Array.isArray(data[level]) ? data[level] : [];
      }
      setValues(next);
      setPullStatus("ok");
      setTimeout(() => setPullStatus("idle"), 2000);
    } catch {
      setPullStatus("error");
      setTimeout(() => setPullStatus("idle"), 2000);
    }
  }, []);

  useImperativeHandle(ref, () => ({ pullFromDb: handlePullFromDb }), [handlePullFromDb]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const body: Record<string, Record<string, string[]>> = {
        learn_recommended: {},
      };
      for (const level of LEVELS) {
        body.learn_recommended[level] = values[level] || [];
      }
      const res = await fetch("/api/admin/site-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to save");
      setStatus("ok");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <AdminCard>
        <div className="space-y-6">
          {LEVELS.map((level) => (
            <div key={level}>
              <label className="block text-sm font-medium text-charcoal mb-1">
                {levelLabels[level] || level}
              </label>
              <textarea
                rows={2}
                className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-charcoal text-sm"
                placeholder="slug-one, slug-two, slug-three (comma or newline separated)"
                value={getRaw(level)}
                onChange={(e) => setRaw(level, e.target.value)}
              />
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" className="btn-primary" disabled={status === "loading"}>
              {status === "loading" ? "Saving…" : "Save recommended"}
            </button>
            <button
              type="button"
              onClick={handlePullFromDb}
              disabled={pullStatus === "loading"}
              className="px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal text-sm hover:bg-[var(--divider)]/20 disabled:opacity-50"
            >
              {pullStatus === "loading" ? "Loading…" : "Pull from database"}
            </button>
            {status === "ok" && <span className="text-green-600 text-sm">Saved.</span>}
            {status === "error" && <span className="text-red-600 text-sm">Failed to save.</span>}
            {pullStatus === "ok" && <span className="text-green-600 text-sm">Filled from DB.</span>}
            {pullStatus === "error" && <span className="text-red-600 text-sm">Failed to pull.</span>}
          </div>
        </div>
      </AdminCard>
    </form>
  );
});
