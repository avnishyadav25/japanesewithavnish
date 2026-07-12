"use client";

import { useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";

type Settings = Record<string, string>;

export function AdminPaymentSettingsForm({ initial }: { initial: Settings }) {
  const [acceptInr, setAcceptInr] = useState(initial.payment_accept_inr !== "false");
  const [acceptUsd, setAcceptUsd] = useState(initial.payment_accept_usd === "true");
  const [defaultProvider, setDefaultProvider] = useState(initial.payment_default_provider || "razorpay");
  const [status, setStatus] = useState<"idle" | "loading" | "saved" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_accept_inr: acceptInr ? "true" : "false",
          payment_accept_usd: acceptUsd ? "true" : "false",
          payment_default_provider: defaultProvider,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <AdminCard>
        <h3 className="font-heading font-bold text-charcoal text-sm mb-4">Accepted Currencies</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input type="checkbox" id="acceptInr" checked={acceptInr} onChange={(e) => setAcceptInr(e.target.checked)} className="h-4 w-4 text-primary focus:ring-primary rounded" />
            <label htmlFor="acceptInr" className="text-xs text-charcoal font-semibold">Accept INR (₹)</label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="acceptUsd" checked={acceptUsd} onChange={(e) => setAcceptUsd(e.target.checked)} className="h-4 w-4 text-primary focus:ring-primary rounded" />
            <label htmlFor="acceptUsd" className="text-xs text-charcoal font-semibold">Accept USD ($)</label>
          </div>
        </div>
      </AdminCard>

      <AdminCard>
        <h3 className="font-heading font-bold text-charcoal text-sm mb-4">Default Payment Provider</h3>
        <select
          value={defaultProvider}
          onChange={(e) => setDefaultProvider(e.target.value)}
          className="w-full h-10 px-3 border border-[var(--divider)] rounded-xl text-xs text-charcoal bg-white"
        >
          <option value="razorpay">Razorpay</option>
          <option value="stripe">Stripe</option>
        </select>
        <p className="text-[10px] text-secondary mt-2">
          API keys and secrets are configured via environment variables, never stored here.
        </p>
      </AdminCard>

      <div className="flex items-center gap-4">
        <button type="submit" className="btn-primary" disabled={status === "loading"}>
          {status === "loading" ? "Saving..." : "Save"}
        </button>
        {status === "saved" && <span className="text-emerald-600 text-sm">Saved.</span>}
        {status === "error" && <span className="text-red-600 text-sm">Failed to save.</span>}
      </div>
    </form>
  );
}
