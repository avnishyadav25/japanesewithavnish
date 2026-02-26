"use client";

import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setStatus("sent");
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Something went wrong. Try again.");
    }
  }

  return (
    <div className="py-12 sm:py-20 px-4 sm:px-6">
      <div className="max-w-[1200px] mx-auto">
        <div className="bento-grid">
          <div className="bento-span-4 bento-row-2 card flex flex-col justify-center">
            <h1 className="font-heading text-2xl font-bold text-charcoal mb-2">Access My Library</h1>
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
                  className="w-full px-4 py-3 border-2 border-[var(--divider)] rounded-bento text-charcoal focus:border-primary focus:outline-none transition"
                />
                <button type="submit" className="btn-primary w-full" disabled={status === "loading"}>
                  {status === "loading" ? "Sending..." : "Send Magic Link"}
                </button>
                {status === "error" && (
                  <p className="text-primary text-sm">{errorMsg || "Something went wrong. Try again."}</p>
                )}
              </form>
            )}

            <p className="text-secondary text-sm mt-8">
              <Link href="/" className="hover:text-primary">← Back to home</Link>
            </p>
          </div>
          <div className="bento-span-2 bento-row-2 card flex flex-col justify-center bg-base border-[var(--divider)]">
            <p className="text-secondary text-sm">
              Secure magic link login. No passwords stored.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
