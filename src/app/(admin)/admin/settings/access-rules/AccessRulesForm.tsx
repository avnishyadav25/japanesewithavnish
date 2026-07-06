"use client";

import { useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";

export function AccessRulesForm({ initial }: { initial: Record<string, string> }) {
  const [limit, setLimit] = useState(initial.free_daily_limit || "2");
  const [tz, setTz] = useState(initial.timezone || "Asia/Kolkata");
  const [resetTime, setResetTime] = useState(initial.reset_time || "00:00");
  const [keepProgress, setKeepProgress] = useState(initial.keep_progress_on_expiry === "true");
  const [warningText, setWarningText] = useState(initial.locked_warning_text || "");
  const [upgradeLabel, setUpgradeLabel] = useState(initial.upgrade_button_label || "");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg("");

    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          free_daily_limit: Number(limit),
          timezone: tz,
          reset_time: resetTime,
          keep_progress_on_expiry: keepProgress ? "true" : "false",
          locked_warning_text: warningText,
          upgrade_button_label: upgradeLabel,
        }),
      });

      if (!res.ok) throw new Error("Failed to save settings");
      setMsg("✅ Access rules settings updated successfully!");
    } catch (err: any) {
      setMsg(`❌ Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {msg && (
        <div className="p-4 bg-white border border-[var(--divider)] rounded-2xl text-xs font-semibold shadow-sm">
          {msg}
        </div>
      )}

      <AdminCard>
        <h3 className="font-heading font-bold text-charcoal text-sm mb-4">Lesson Limits & Schedule</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase text-secondary mb-1">Free Sequential Daily Lesson Limit</label>
            <input
              type="number"
              min="0"
              required
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="w-full h-10 px-3 border border-[var(--divider)] rounded-xl text-xs text-charcoal focus:outline-none"
            />
            <span className="text-[10px] text-secondary mt-1 block">Maximum consecutive new lessons a free tier student can study per day.</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase text-secondary mb-1">Reset Timezone</label>
              <select
                value={tz}
                onChange={(e) => setTz(e.target.value)}
                className="w-full h-10 px-3 border border-[var(--divider)] rounded-xl text-xs text-charcoal bg-white"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="UTC">Coordinated Universal Time (UTC)</option>
                <option value="America/New_York">America/New_York (EST/EDT)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-secondary mb-1">Daily Lock Reset Time</label>
              <input
                type="time"
                required
                value={resetTime}
                onChange={(e) => setResetTime(e.target.value)}
                className="w-full h-10 px-3 border border-[var(--divider)] rounded-xl text-xs text-charcoal focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="keepProgress"
              checked={keepProgress}
              onChange={(e) => setKeepProgress(e.target.checked)}
              className="h-4 w-4 text-primary focus:ring-primary rounded"
            />
            <label htmlFor="keepProgress" className="text-xs text-charcoal font-semibold">
              Retain points, XP, and badges when Premium pass expires
            </label>
          </div>
        </div>
      </AdminCard>

      <AdminCard>
        <h3 className="font-heading font-bold text-charcoal text-sm mb-4">Locked Lesson Warning Message Copy</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase text-secondary mb-1">Locked Lesson Warning Text</label>
            <textarea
              required
              rows={3}
              value={warningText}
              onChange={(e) => setWarningText(e.target.value)}
              className="w-full p-3 border border-[var(--divider)] rounded-xl text-xs text-charcoal focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase text-secondary mb-1">Upgrade CTA Button Label</label>
            <input
              type="text"
              required
              value={upgradeLabel}
              onChange={(e) => setUpgradeLabel(e.target.value)}
              className="w-full h-10 px-3 border border-[var(--divider)] rounded-xl text-xs text-charcoal focus:outline-none"
            />
          </div>
        </div>
      </AdminCard>

      <button
        type="submit"
        disabled={saving}
        className="w-full btn-primary h-11 rounded-xl text-xs font-bold font-heading"
      >
        {saving ? "Saving Changes..." : "Save Access Rules"}
      </button>
    </form>
  );
}
