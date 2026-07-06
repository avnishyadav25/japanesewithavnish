"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Tab = "magic" | "signin" | "signup" | "forgot";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const redirect = searchParams?.get("redirect") || "/learn/dashboard";
  const safeRedirect = redirect.startsWith("/") ? redirect : "/learn/dashboard";
  const showForgot = searchParams?.get("forgot") === "1";

  const [tab, setTab] = useState<Tab>(showForgot ? "forgot" : "magic");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [targetLevel, setTargetLevel] = useState("N5");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [forgotSuccessMessage, setForgotSuccessMessage] = useState("");

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, redirect: safeRedirect }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setStatus("success");
      window.location.href = data.redirect || safeRedirect;
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Invalid email or password.");
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!agreedTerms) {
      setErrorMsg("Please agree to the Terms of Service and Privacy Policy.");
      setStatus("error");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setErrorMsg("");

    const spaceIdx = name.trim().indexOf(" ");
    const firstName = spaceIdx !== -1 ? name.trim().substring(0, spaceIdx) : name.trim();
    const lastName = spaceIdx !== -1 ? name.trim().substring(spaceIdx + 1) : "";

    try {
      const res = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          first_name: firstName,
          last_name: lastName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      // Auto Sign-in
      const signInRes = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, redirect: safeRedirect }),
      });
      const signInData = await signInRes.json();
      if (signInRes.ok && signInData.redirect) {
        // Update Target Level
        if (targetLevel) {
          await fetch("/api/profile", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ target_level: targetLevel, onboarding_completed: true }),
          }).catch(() => {});
        }
        window.location.href = "/learn/dashboard";
        return;
      }
      setStatus("success");
      setTab("signin");
      setPassword("");
      setConfirmPassword("");
      setErrorMsg("");
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Try again.");
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setForgotSuccessMessage(typeof data.message === "string" ? data.message : "Check your email.");
      setStatus("success");
      setErrorMsg("");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Try again.");
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
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
      setStatus("success");
      setErrorMsg("");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Try again.");
    }
  }

  const isMagicSent = tab === "magic" && status === "success";

  return (
    <div className="py-12 sm:py-20 px-4 sm:px-6 bg-[var(--base)] min-h-[85vh] flex items-center">
      <div className="max-w-[1000px] mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch">
          
          {/* Left Form Card */}
          <div className="md:col-span-7 bg-white rounded-3xl p-8 border border-[var(--divider)] shadow-card flex flex-col justify-between min-h-[500px]">
            {isMagicSent ? (
              <div className="space-y-6 my-auto text-center py-8">
                <span className="text-5xl" role="img" aria-label="email">✉️</span>
                <h2 className="font-heading text-2xl font-black text-charcoal">Check your email</h2>
                <p className="text-secondary text-sm max-w-sm mx-auto leading-relaxed">
                  We sent a secure, passwordless sign-in link to: <br />
                  <strong className="text-charcoal font-semibold">{email}</strong>
                </p>
                <p className="text-secondary text-xs">Open the link to continue learning.</p>
                <div className="flex gap-4 justify-center pt-4">
                  <button
                    type="button"
                    onClick={handleMagicLink}
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Resend Link
                  </button>
                  <span className="text-[var(--divider)]">|</span>
                  <button
                    type="button"
                    onClick={() => { setTab("magic"); setStatus("idle"); }}
                    className="text-xs font-bold text-secondary hover:underline"
                  >
                    Use Different Email
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-6">
                  <h1 className="font-heading text-3xl font-black text-charcoal mb-2">Welcome back</h1>
                  <p className="text-secondary text-sm">
                    Sign in to continue your Japanese learning, track progress, and access your lessons.
                  </p>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mb-6 border-b border-[var(--divider)]">
                  {(["magic", "signin", "signup"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setTab(t);
                        setStatus("idle");
                        setErrorMsg("");
                      }}
                      className={`pb-2.5 px-1 text-sm font-semibold border-b-2 -mb-[2px] transition capitalize ${
                        tab === t
                          ? "border-primary text-primary"
                          : "border-transparent text-secondary hover:text-charcoal"
                      }`}
                    >
                      {t === "magic" ? "Magic Link" : t === "signin" ? "Sign In" : "Sign Up"}
                    </button>
                  ))}
                </div>

                {/* Form fields depending on Tab */}
                {tab === "magic" && (
                  <form onSubmit={handleMagicLink} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-charcoal mb-1">Email Address</label>
                      <input
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full h-12 px-4 border border-[var(--divider)] rounded-xl text-charcoal focus:border-primary focus:outline-none text-sm transition"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={status === "loading"}
                      className="w-full h-12 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/95 transition disabled:opacity-50"
                    >
                      {status === "loading" ? "Sending..." : "Send Magic Link"}
                    </button>
                    <p className="text-xs text-secondary text-center">
                      No password needed. We&apos;ll email you a secure sign-in link.
                    </p>
                  </form>
                )}

                {tab === "signin" && (
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-charcoal mb-1">Email Address</label>
                      <input
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full h-12 px-4 border border-[var(--divider)] rounded-xl text-charcoal focus:border-primary focus:outline-none text-sm transition"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-bold uppercase text-charcoal">Password</label>
                        <button
                          type="button"
                          onClick={() => { setTab("forgot"); setStatus("idle"); setErrorMsg(""); }}
                          className="text-xs text-primary hover:underline"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full h-12 px-4 border border-[var(--divider)] rounded-xl text-charcoal focus:border-primary focus:outline-none text-sm transition"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={status === "loading"}
                      className="w-full h-12 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/95 transition disabled:opacity-50"
                    >
                      {status === "loading" ? "Signing in..." : "Sign In"}
                    </button>
                  </form>
                )}

                {tab === "signup" && (
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-charcoal mb-1">Full Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Taro Yamada"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="w-full h-12 px-4 border border-[var(--divider)] rounded-xl text-charcoal focus:border-primary focus:outline-none text-sm transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-charcoal mb-1">Email Address</label>
                      <input
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full h-12 px-4 border border-[var(--divider)] rounded-xl text-charcoal focus:border-primary focus:outline-none text-sm transition"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase text-charcoal mb-1">Password</label>
                        <input
                          type="password"
                          placeholder="Min 8 characters"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={8}
                          className="w-full h-12 px-4 border border-[var(--divider)] rounded-xl text-charcoal focus:border-primary focus:outline-none text-sm transition"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase text-charcoal mb-1">Confirm Password</label>
                        <input
                          type="password"
                          placeholder="Repeat password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          minLength={8}
                          className="w-full h-12 px-4 border border-[var(--divider)] rounded-xl text-charcoal focus:border-primary focus:outline-none text-sm transition"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-charcoal mb-1">Target JLPT Level</label>
                      <select
                        value={targetLevel}
                        onChange={(e) => setTargetLevel(e.target.value)}
                        className="w-full h-12 px-4 border border-[var(--divider)] rounded-xl text-charcoal focus:border-primary focus:outline-none text-sm bg-white"
                      >
                        <option value="N5">N5 (Beginner)</option>
                        <option value="N4">N4 (Elementary)</option>
                        <option value="N3">N3 (Intermediate)</option>
                        <option value="N2">N2 (Upper Intermediate)</option>
                        <option value="N1">N1 (Advanced)</option>
                        <option value="Not Sure">Not sure yet</option>
                      </select>
                    </div>
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agreedTerms}
                        onChange={(e) => setAgreedTerms(e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-primary rounded border-[var(--divider)] shrink-0"
                      />
                      <span className="text-[11px] text-secondary leading-relaxed">
                        I agree to the{" "}
                        <a href="/policies/terms" target="_blank" className="text-primary hover:underline font-medium">Terms of Service</a>{" "}
                        and{" "}
                        <a href="/policies/privacy" target="_blank" className="text-primary hover:underline font-medium">Privacy Policy</a>
                      </span>
                    </label>
                    <button
                      type="submit"
                      disabled={status === "loading" || !agreedTerms}
                      className="w-full h-12 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/95 transition disabled:opacity-50"
                    >
                      {status === "loading" ? "Creating account..." : "Create Free Account"}
                    </button>
                    <p className="text-[11px] text-secondary text-center">
                      Free users can study 2 lessons daily. Upgrade anytime for unlimited access.
                    </p>
                  </form>
                )}

                {tab === "forgot" && (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-charcoal mb-1">Email Address</label>
                      <input
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full h-12 px-4 border border-[var(--divider)] rounded-xl text-charcoal focus:border-primary focus:outline-none text-sm transition"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={status === "loading"}
                      className="w-full h-12 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/95 transition disabled:opacity-50"
                    >
                      {status === "loading" ? "Sending link..." : "Send Reset Link"}
                    </button>
                    {status === "success" && (
                      <p className="text-xs text-primary font-semibold text-center">{forgotSuccessMessage}</p>
                    )}
                  </form>
                )}

                {status === "error" && (
                  <div className="mt-4 p-3 bg-[#FFF7F7] border border-primary/10 rounded-xl text-xs text-primary font-medium">
                    {errorMsg}
                  </div>
                )}
              </div>
            )}

            <div className="pt-6 border-t border-[var(--divider)] mt-8">
              <Link href="/" className="text-xs font-bold text-secondary hover:text-charcoal flex items-center gap-1.5">
                ← Back to home
              </Link>
            </div>
          </div>

          {/* Right Benefits Card */}
          <div className="md:col-span-5 bg-white rounded-3xl p-8 border border-[var(--divider)] border-l-[3px] border-l-primary shadow-card flex flex-col justify-between">
            <div className="space-y-6">
              <h2 className="font-heading text-xl font-black text-charcoal">Your learning stays with you</h2>
              <ul className="space-y-3">
                {[
                  "Continue where you left off",
                  "Track your JLPT progress",
                  "Earn XP, points, and badges",
                  "Build your daily streak",
                  "Access premium lessons if upgraded"
                ].map((b, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-charcoal">
                    <span className="text-primary font-bold">✓</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-6 border-t border-[var(--divider)] mt-8">
              <p className="text-xs text-secondary mb-1">Not sure your level?</p>
              <Link href="/quiz" className="text-sm font-bold text-primary hover:underline flex items-center gap-1">
                Take the placement quiz →
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
