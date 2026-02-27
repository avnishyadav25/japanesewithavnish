"use client";

import { useState } from "react";

export function LeadMagnetForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source: "lead_magnet" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatus("success");
        setEmail("");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="card">
      <h2 className="font-heading text-2xl font-bold text-charcoal mb-2">Free N5 Kana Practice Pack</h2>
      <p className="text-secondary text-sm mb-4">Get instant access. No spam.</p>
      {status === "success" ? (
        <p className="text-primary font-medium">Check your email for the download link.</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={status === "loading"}
            className="flex-1 h-11 px-4 border border-[#EEEEEE] rounded-lg text-charcoal focus:border-primary focus:outline-none transition disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="btn-primary disabled:opacity-60"
          >
            {status === "loading" ? "..." : "Get Free Pack"}
          </button>
        </form>
      )}
      <p className="text-secondary text-xs mt-3">No spam. Unsubscribe anytime.</p>
      {status === "error" && (
        <p className="text-primary text-xs mt-2">Something went wrong. Try again.</p>
      )}
    </div>
  );
}
