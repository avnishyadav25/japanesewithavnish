"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  if (!token) {
    return (
      <div className="bento-span-4 bento-row-2 card flex flex-col justify-center">
        <h1 className="font-heading text-2xl font-bold text-charcoal mb-2">Invalid or expired link</h1>
        <p className="text-secondary text-sm mb-6">
          This reset link is missing or has expired. Request a new one from the login page.
        </p>
        <Link href="/login?forgot=1" className="btn-primary w-full text-center inline-block">
          Request new link
        </Link>
        <p className="text-secondary text-sm mt-6">
          <Link href="/login" className="hover:text-primary">← Back to login</Link>
        </p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setStatus("success");
      if (data.redirect) {
        window.location.href = data.redirect;
        return;
      }
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Something went wrong. Try again.");
    }
  }

  return (
    <div className="bento-span-4 bento-row-2 card flex flex-col justify-center">
      <h1 className="font-heading text-2xl font-bold text-charcoal mb-2">Reset your password</h1>
      <p className="text-secondary text-sm mb-6">
        Enter your new password below. You’ll be signed in after resetting.
      </p>
      {status === "success" ? (
        <p className="text-primary font-medium">Redirecting...</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="New password (min 8 characters)"
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
            {status === "loading" ? "Resetting..." : "Reset password"}
          </button>
          {status === "error" && (
            <p className="text-primary text-sm">{errorMsg}</p>
          )}
        </form>
      )}
      <p className="text-secondary text-sm mt-8">
        <Link href="/login" className="hover:text-primary">← Back to login</Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="py-12 sm:py-20 px-4 sm:px-6">
      <div className="max-w-[1200px] mx-auto">
        <div className="bento-grid">
          <Suspense fallback={<div className="bento-span-4 bento-row-2 card flex flex-col justify-center">Loading...</div>}>
            <ResetPasswordForm />
          </Suspense>
          <div className="bento-span-2 bento-row-2 card flex flex-col justify-center bg-base border-[var(--divider)]">
            <p className="text-secondary text-sm">
              Use a strong password you don’t use elsewhere. You can change it later in account settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
