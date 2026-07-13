"use client";

import { useState } from "react";

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), message: message.trim(), website }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setError(data.error || "Something went wrong.");
      } else {
        setStatus("success");
        setTimeout(() => {
          setOpen(false);
          setStatus("idle");
          setName("");
          setEmail("");
          setMessage("");
        }, 3000);
      }
    } catch {
      setStatus("error");
      setError("Failed to send. Please try again.");
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 max-md:bottom-20">
      {open && (
        <div className="w-80 bg-white rounded-xl shadow-2xl border border-[#EEEEEE] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold text-charcoal text-base">Share a suggestion</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[#999] hover:text-charcoal transition"
              aria-label="Close feedback form"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {status === "success" ? (
            <div className="text-center py-4">
              <p className="text-primary font-semibold text-sm">Thanks for your feedback!</p>
              <p className="text-secondary text-xs mt-1">We appreciate your suggestion.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Your suggestion or feedback…"
                required
                maxLength={2000}
                rows={3}
                className="w-full border border-[#EEEEEE] rounded-lg px-3 py-2 text-sm text-charcoal placeholder-[#aaa] focus:outline-none focus:border-primary resize-none"
              />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name (optional)"
                maxLength={100}
                className="w-full border border-[#EEEEEE] rounded-lg px-3 py-2 text-sm text-charcoal placeholder-[#aaa] focus:outline-none focus:border-primary"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email (optional)"
                className="w-full border border-[#EEEEEE] rounded-lg px-3 py-2 text-sm text-charcoal placeholder-[#aaa] focus:outline-none focus:border-primary"
              />
              {/* Honeypot field (visually hidden) */}
              <div className="hidden" aria-hidden="true">
                <input
                  type="text"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button
                type="submit"
                disabled={status === "loading" || !message.trim()}
                className="bg-primary text-white font-semibold py-2 px-4 rounded-lg text-sm hover:bg-primary/90 transition disabled:opacity-50"
              >
                {status === "loading" ? "Sending…" : "Send Feedback"}
              </button>
            </form>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 bg-primary text-white font-semibold py-2.5 px-4 rounded-full shadow-lg hover:bg-primary/90 transition text-sm"
        aria-label="Give feedback or suggestion"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        Feedback
      </button>
    </div>
  );
}
