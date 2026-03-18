"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Tab = "signin" | "signup" | "magic" | "forgot";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const redirect = searchParams?.get("redirect") || "/learn/dashboard";
  const safeRedirect = redirect.startsWith("/") ? redirect : "/learn/dashboard";
  const showForgot = searchParams?.get("forgot") === "1";

  const [tab, setTab] = useState<Tab>(showForgot ? "forgot" : "signin");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Invalid email or password.");
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setStatus("success");
      setTab("signin");
      setPassword("");
      setConfirmPassword("");
      setErrorMsg("");
      setStatus("idle");
      // Option: auto sign in here by calling sign-in then redirect
      const signInRes = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, redirect: safeRedirect }),
      });
      const signInData = await signInRes.json();
      if (signInRes.ok && signInData.redirect) {
        window.location.href = signInData.redirect;
        return;
      }
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Something went wrong. Try again.");
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
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Something went wrong. Try again.");
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
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Something went wrong. Try again.");
    }
  }

  const isMagicSent = tab === "magic" && status === "success";

  return (
    <div className="py-12 sm:py-20 px-4 sm:px-6">
      <div className="max-w-[1200px] mx-auto">
        <div className="bento-grid">
          <div className="bento-span-4 bento-row-2 card flex flex-col justify-center">
            <h1 className="font-heading text-2xl font-bold text-charcoal mb-2">Sign in</h1>
            <p className="text-secondary text-sm mb-6">
              Use your email and password, or get a magic link.
            </p>

            <div className="flex gap-2 mb-6 border-b border-[var(--divider)]">
              <button
                type="button"
                onClick={() => { setTab("signin"); setStatus("idle"); setErrorMsg(""); }}
                className={`pb-2 px-1 text-sm font-medium border-b-2 -mb-[2px] transition ${tab === "signin" ? "border-primary text-primary" : "border-transparent text-secondary hover:text-charcoal"}`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => { setTab("signup"); setStatus("idle"); setErrorMsg(""); }}
                className={`pb-2 px-1 text-sm font-medium border-b-2 -mb-[2px] transition ${tab === "signup" ? "border-primary text-primary" : "border-transparent text-secondary hover:text-charcoal"}`}
              >
                Sign up
              </button>
              <button
                type="button"
                onClick={() => { setTab("magic"); setStatus("idle"); setErrorMsg(""); }}
                className={`pb-2 px-1 text-sm font-medium border-b-2 -mb-[2px] transition ${tab === "magic" ? "border-primary text-primary" : "border-transparent text-secondary hover:text-charcoal"}`}
              >
                Magic link
              </button>
              <button
                type="button"
                onClick={() => { setTab("forgot"); setStatus("idle"); setErrorMsg(""); setForgotSuccessMessage(""); }}
                className={`pb-2 px-1 text-sm font-medium border-b-2 -mb-[2px] transition ${tab === "forgot" ? "border-primary text-primary" : "border-transparent text-secondary hover:text-charcoal"}`}
              >
                Forgot password
              </button>
            </div>

            {tab === "signin" && (
              <>
                {status === "success" ? (
                  <p className="text-primary font-medium">Redirecting...</p>
                ) : (
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <input
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-4 py-3 border-2 border-[var(--divider)] rounded-bento text-charcoal focus:border-primary focus:outline-none transition"
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full px-4 py-3 border-2 border-[var(--divider)] rounded-bento text-charcoal focus:border-primary focus:outline-none transition"
                    />
                    <p className="text-sm">
                      <button
                        type="button"
                        onClick={() => { setTab("forgot"); setStatus("idle"); setErrorMsg(""); setForgotSuccessMessage(""); }}
                        className="text-primary hover:underline"
                      >
                        Forgot password?
                      </button>
                    </p>
                    <button type="submit" className="btn-primary w-full" disabled={status === "loading"}>
                      {status === "loading" ? "Signing in..." : "Sign in"}
                    </button>
                    {status === "error" && (
                      <p className="text-primary text-sm">{errorMsg}</p>
                    )}
                  </form>
                )}
              </>
            )}

            {tab === "signup" && (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-[var(--divider)] rounded-bento text-charcoal focus:border-primary focus:outline-none transition"
                  />
                  <input
                    type="text"
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-[var(--divider)] rounded-bento text-charcoal focus:border-primary focus:outline-none transition"
                  />
                </div>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border-2 border-[var(--divider)] rounded-bento text-charcoal focus:border-primary focus:outline-none transition"
                />
                <input
                  type="password"
                  placeholder="Password (min 8 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-3 border-2 border-[var(--divider)] rounded-bento text-charcoal focus:border-primary focus:outline-none transition"
                />
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-3 border-2 border-[var(--divider)] rounded-bento text-charcoal focus:border-primary focus:outline-none transition"
                />
                <button type="submit" className="btn-primary w-full" disabled={status === "loading"}>
                  {status === "loading" ? "Creating account..." : "Sign up"}
                </button>
                {status === "error" && (
                  <p className="text-primary text-sm">{errorMsg}</p>
                )}
              </form>
            )}

            {tab === "forgot" && (
              <>
                {status === "success" ? (
                  <p className="text-primary font-medium">
                    {forgotSuccessMessage}
                  </p>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <input
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-4 py-3 border-2 border-[var(--divider)] rounded-bento text-charcoal focus:border-primary focus:outline-none transition"
                    />
                    <button type="submit" className="btn-primary w-full" disabled={status === "loading"}>
                      {status === "loading" ? "Sending..." : "Send reset link"}
                    </button>
                    {status === "error" && (
                      <p className="text-primary text-sm">{errorMsg}</p>
                    )}
                  </form>
                )}
              </>
            )}

            {tab === "magic" && (
              <>
                {isMagicSent ? (
                  <p className="text-primary font-medium">
                    Check your email for the login link. It expires in 1 hour.
                  </p>
                ) : (
                  <form onSubmit={handleMagicLink} className="space-y-4">
                    <input
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-4 py-3 border-2 border-[var(--divider)] rounded-bento text-charcoal focus:border-primary focus:outline-none transition"
                    />
                    <button type="submit" className="btn-primary w-full" disabled={status === "loading"}>
                      {status === "loading" ? "Sending..." : "Send magic link"}
                    </button>
                    {status === "error" && (
                      <p className="text-primary text-sm">{errorMsg}</p>
                    )}
                  </form>
                )}
              </>
            )}

            <p className="text-secondary text-sm mt-8">
              <Link href="/" className="hover:text-primary">← Back to home</Link>
            </p>
          </div>
          <div className="bento-span-2 bento-row-2 card flex flex-col justify-center bg-base border-[var(--divider)]">
            <p className="text-secondary text-sm">
              Sign in to access your progress, rewards, library, and more.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
