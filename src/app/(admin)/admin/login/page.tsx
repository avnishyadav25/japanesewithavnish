"use client";

import { useState } from "react";
import Link from "next/link";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      window.location.href = "/admin";
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Something went wrong. Try again.");
    }
  }

  return (
    <div className="min-h-screen bg-base flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bento-grid">
          <div className="bento-span-6 card">
            <h1 className="font-heading text-2xl font-bold text-charcoal mb-2">Admin Login</h1>
            <p className="text-secondary mb-6">
              Enter your admin credentials to access the panel.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 border-2 border-[var(--divider)] rounded-bento text-charcoal focus:border-primary focus:outline-none transition"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 border-2 border-[var(--divider)] rounded-bento text-charcoal focus:border-primary focus:outline-none transition"
              />
              <button type="submit" className="btn-primary w-full" disabled={status === "loading"}>
                {status === "loading" ? "Signing in..." : "Sign in"}
              </button>
              {status === "error" && (
                <p className="text-primary text-sm">{errorMsg}</p>
              )}
            </form>

            <p className="text-secondary text-sm mt-6">
              <Link href="/" className="hover:text-primary">← Back to site</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
