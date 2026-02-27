"use client";

import { useState } from "react";

export function NewsletterForm({ variant = "light", source = "footer" }: { variant?: "light" | "dark"; source?: string }) {
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
        body: JSON.stringify({ email: email.trim(), source }),
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

  const isDark = variant === "dark";
  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 max-w-sm">
      <input
        type="email"
        placeholder="Your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        disabled={status === "loading" || status === "success"}
        className={`flex-1 px-4 py-2.5 rounded-lg text-sm focus:outline-none transition disabled:opacity-60 ${
          isDark
            ? "bg-white/10 border border-white/30 text-[#FAF8F5] placeholder:text-[#FAF8F5]/60 focus:border-primary"
            : "border-2 border-[var(--divider)] focus:border-primary"
        }`}
      />
      <button
        type="submit"
        disabled={status === "loading" || status === "success"}
        className="btn-primary text-sm py-2.5 px-4 shrink-0 disabled:opacity-60"
      >
        {status === "loading" ? "..." : status === "success" ? "Subscribed!" : "Subscribe"}
      </button>
      {status === "error" && <p className="text-primary text-xs sm:col-span-2">Something went wrong. Try again.</p>}
    </form>
  );
}
