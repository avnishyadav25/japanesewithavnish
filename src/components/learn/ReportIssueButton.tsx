"use client";

import { useState } from "react";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "japanese_mistake", label: "Japanese mistake" },
  { value: "wrong_meaning", label: "Wrong meaning" },
  { value: "wrong_reading", label: "Wrong reading" },
  { value: "wrong_answer", label: "Wrong answer" },
  { value: "audio_problem", label: "Audio problem" },
  { value: "broken_image", label: "Broken image" },
  { value: "too_difficult", label: "Content too difficult" },
  { value: "unclear", label: "Content unclear" },
  { value: "duplicate", label: "Duplicate content" },
  { value: "other", label: "Other" },
];

export function ReportIssueButton({ entityType, entityId }: { entityType: string; entityId: string }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0].value);
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/learn/report-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId, category, message: message || null, website }),
      });
      if (!res.ok) throw new Error("failed");
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return <p className="text-sm text-secondary mt-6">Thanks — your report has been sent for review.</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-secondary hover:text-primary underline mt-6"
      >
        Report an issue with this content
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 p-4 border border-[var(--divider)] rounded-bento max-w-md">
      <p className="text-sm font-medium text-charcoal mb-3">Report an issue</p>
      <div className="mb-3">
        <label className="block text-xs text-secondary mb-1">What's wrong?</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm bg-white"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-3">
        <label className="block text-xs text-secondary mb-1">Details (optional)</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
          rows={3}
          className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm"
        />
      </div>
      {/* Honeypot — hidden from real users via CSS, bots that fill every field will trip it */}
      <input
        type="text"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
      />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={status === "loading"} className="btn-primary text-sm disabled:opacity-50">
          {status === "loading" ? "Sending…" : "Send report"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-secondary hover:underline">
          Cancel
        </button>
        {status === "error" && <span className="text-sm text-red-600">Failed to send — try again.</span>}
      </div>
    </form>
  );
}
