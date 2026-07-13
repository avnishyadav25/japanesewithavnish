"use client";

import { useState } from "react";

const MODES = [
  { value: "manual_review", label: "Manual review", description: "Winners are recorded but no automatic action is taken — a human decides how to reward them." },
  { value: "auto_coupon", label: "Auto-generated coupon", description: "A single-use 100%-off coupon is created and emailed to each winner." },
  { value: "direct_grant", label: "Direct premium grant", description: "Each winner's account gets one month of premium access added directly." },
];

export function RewardModeForm({ initialMode }: { initialMode: string }) {
  const [mode, setMode] = useState(initialMode);
  const [status, setStatus] = useState<"idle" | "loading" | "saved" | "error">("idle");

  async function handleSave() {
    setStatus("loading");
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaderboard_reward_mode: mode }),
      });
      if (!res.ok) throw new Error("Failed");
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div>
      <h3 className="font-heading font-semibold text-charcoal mb-3">Reward mode</h3>
      <div className="space-y-3">
        {MODES.map((m) => (
          <label key={m.value} className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="reward_mode"
              value={m.value}
              checked={mode === m.value}
              onChange={() => setMode(m.value)}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium text-charcoal">{m.label}</span>
              <span className="block text-secondary text-xs mt-0.5">{m.description}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-4">
        <button type="button" onClick={handleSave} disabled={status === "loading"} className="btn-primary text-sm py-2 px-4 disabled:opacity-50">
          {status === "loading" ? "Saving…" : "Save"}
        </button>
        {status === "saved" && <span className="text-emerald-600 text-sm">Saved.</span>}
        {status === "error" && <span className="text-red-600 text-sm">Failed to save.</span>}
      </div>
    </div>
  );
}
