"use client";

import { useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";

export type ProgressionRules = {
  max_reviews_due_before_advance: number;
  min_accuracy_to_unlock_module: number;
  daily_min_kanji: number;
  daily_min_reading: number;
};

export function ProgressionRulesForm({ initial }: { initial: ProgressionRules }) {
  const [rules, setRules] = useState<ProgressionRules>(initial);
  const [status, setStatus] = useState<"idle" | "loading" | "saved" | "error">("idle");

  function update<K extends keyof ProgressionRules>(key: K, value: number) {
    setRules((r) => ({ ...r, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progression_rules: rules }),
      });
      if (!res.ok) throw new Error("Failed");
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <AdminCard>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-secondary text-sm">
          These values are used when computing &quot;next lesson&quot; and module unlock (e.g. suggest review first if reviews due &gt; N).
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Max reviews due before advance</label>
            <input
              type="number"
              min={0}
              value={rules.max_reviews_due_before_advance}
              onChange={(e) => update("max_reviews_due_before_advance", e.target.valueAsNumber || 0)}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Min accuracy to unlock module (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={rules.min_accuracy_to_unlock_module}
              onChange={(e) => update("min_accuracy_to_unlock_module", e.target.valueAsNumber || 0)}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Daily min kanji (checklist)</label>
            <input
              type="number"
              min={0}
              value={rules.daily_min_kanji}
              onChange={(e) => update("daily_min_kanji", e.target.valueAsNumber || 0)}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Daily min reading (checklist)</label>
            <input
              type="number"
              min={0}
              value={rules.daily_min_reading}
              onChange={(e) => update("daily_min_reading", e.target.valueAsNumber || 0)}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={status === "loading"}
            className="px-4 py-2 bg-primary text-white rounded-bento font-medium disabled:opacity-60"
          >
            Save
          </button>
          {status === "saved" && <span className="text-sm text-green-600">Saved.</span>}
          {status === "error" && <span className="text-sm text-red-600">Save failed.</span>}
        </div>
      </form>
    </AdminCard>
  );
}
