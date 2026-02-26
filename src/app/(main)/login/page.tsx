"use client";

import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="py-24 px-4 sm:px-6">
      <div className="max-w-[400px] mx-auto">
        <h1 className="text-2xl font-bold text-charcoal mb-2">Access My Library</h1>
        <p className="text-secondary mb-8">
          Enter your email to receive a magic link. No password needed.
        </p>

        {status === "sent" ? (
          <p className="text-primary font-medium">
            Check your email for the login link. It expires in 1 hour.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-[var(--divider)] rounded-button text-charcoal"
            />
            <button type="submit" className="btn-primary w-full" disabled={status === "loading"}>
              {status === "loading" ? "Sending..." : "Send Magic Link"}
            </button>
            {status === "error" && (
              <p className="text-primary text-sm">Something went wrong. Try again.</p>
            )}
          </form>
        )}

        <p className="text-secondary text-sm mt-8">
          <Link href="/" className="hover:text-primary">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
