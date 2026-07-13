"use client";

import { useState } from "react";

export function TrialCodeRedeem() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/trial-codes/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to redeem code");
      setStatus("success");
      setMessage(`Success! ${data.trialDays} days of premium access added to your account.`);
      setCode("");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Failed to redeem code");
    }
  }

  return (
    <div className="bg-white border border-[var(--divider)] rounded-2xl p-5">
      <h3 className="font-heading font-bold text-charcoal mb-1">Have a trial code?</h3>
      <p className="text-secondary text-sm mb-3">Redeem it for free premium access.</p>
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter trial code"
          className="flex-1 min-w-[160px] px-3 py-2 border border-[var(--divider)] rounded-bento text-charcoal text-sm uppercase"
        />
        <button
          type="submit"
          disabled={status === "loading" || !code.trim()}
          className="btn-primary text-sm py-2 px-4 disabled:opacity-50"
        >
          {status === "loading" ? "Redeeming…" : "Redeem"}
        </button>
      </form>
      {message && (
        <p className={`text-sm mt-2 ${status === "success" ? "text-emerald-600" : "text-red-600"}`}>{message}</p>
      )}
    </div>
  );
}
