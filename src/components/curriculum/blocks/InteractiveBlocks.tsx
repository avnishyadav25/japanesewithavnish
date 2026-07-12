"use client";

import { useState } from "react";
import type { CheckpointData, ActionPlanData } from "@/lib/curriculum/blockTypes";

export function CheckpointBlock({ data }: { data: CheckpointData }) {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <div className="bg-white border border-primary/20 rounded-bento p-5">
      <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Checkpoint</p>
      <p className="text-charcoal text-sm font-semibold mb-3">{data.question}</p>
      <div className="space-y-2">
        {data.options.map((opt, i) => {
          const isSelected = selected === i;
          const showResult = selected !== null;
          const isRight = opt.isCorrect;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(i)}
              className={`w-full text-left px-3 py-2 rounded-xl border text-sm transition ${
                showResult && isSelected
                  ? isRight
                    ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                    : "border-red-400 bg-red-50 text-red-900"
                  : "border-[var(--divider)] hover:border-primary/40 text-charcoal"
              }`}
            >
              {opt.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ActionPlanBlock({ data }: { data: ActionPlanData }) {
  const rows = [
    { label: "Today", value: data.today },
    { label: "Tomorrow", value: data.tomorrow },
    { label: "This week", value: data.thisWeek },
  ].filter((r) => r.value);
  if (rows.length === 0) return null;
  return (
    <div className="bg-[#FAF8F5] border border-[var(--divider)] rounded-bento p-5 space-y-2">
      <h3 className="font-heading font-bold text-sm text-charcoal mb-1">Action Plan</h3>
      {rows.map((r) => (
        <p key={r.label} className="text-sm">
          <span className="font-semibold text-charcoal">{r.label}: </span>
          <span className="text-secondary">{r.value}</span>
        </p>
      ))}
    </div>
  );
}
