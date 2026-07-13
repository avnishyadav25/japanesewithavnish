"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ContactSubmissionActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function updateStatus(newStatus: "read" | "replied") {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/contact-submissions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
        credentials: "include",
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function draftReply() {
    setDrafting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/contact-submissions/${id}/ai-reply`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to draft reply");
      setReply(data.draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to draft reply");
    } finally {
      setDrafting(false);
    }
  }

  async function sendReply() {
    if (!reply.trim()) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/contact-submissions/${id}/ai-reply`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send reply");
      setSent(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {status !== "read" && status !== "replied" && (
          <button
            type="button"
            onClick={() => updateStatus("read")}
            disabled={loading}
            className="px-3 py-1.5 rounded-bento text-sm font-medium border border-[var(--divider)] text-charcoal hover:bg-base disabled:opacity-50"
          >
            {loading ? "…" : "Mark read"}
          </button>
        )}
        {status !== "replied" && (
          <button
            type="button"
            onClick={() => updateStatus("replied")}
            disabled={loading}
            className="px-3 py-1.5 rounded-bento text-sm font-medium bg-primary text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "…" : "Mark replied"}
          </button>
        )}
      </div>

      <div className="border-t border-[var(--divider)] pt-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-heading font-semibold text-charcoal text-sm">Reply</h3>
          <button
            type="button"
            onClick={draftReply}
            disabled={drafting}
            className="text-xs font-bold text-primary hover:underline disabled:opacity-50"
          >
            {drafting ? "Drafting…" : "AI Draft Reply"}
          </button>
        </div>
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={6}
          placeholder="Write or AI-draft a reply…"
          className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal text-sm"
        />
        {error && <p className="text-[#D0021B] text-xs mt-1">{error}</p>}
        {sent && <p className="text-emerald-600 text-xs mt-1">Reply sent.</p>}
        <button
          type="button"
          onClick={sendReply}
          disabled={sending || !reply.trim()}
          className="mt-2 btn-primary text-sm px-4 py-2 disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send Reply"}
        </button>
      </div>
    </div>
  );
}
