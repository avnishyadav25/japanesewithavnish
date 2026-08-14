"use client";

import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

type EligibleUser = {
  email: string;
  displayName: string | null;
  currentStreak: number;
  nextLessonTitle: string | null;
  nextLessonId: string | null;
};

export default function AdminNudgesPage() {
  const [users, setUsers] = useState<EligibleUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [drafting, setDrafting] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [sentEmails, setSentEmails] = useState<Set<string>>(new Set());
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchResult, setBatchResult] = useState<string | null>(null);

  function fetchUsers() {
    setLoading(true);
    fetch("/api/admin/nudges")
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((d) => setUsers(d.users ?? []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  async function handleDraft(user: EligibleUser) {
    setDrafting(user.email);
    try {
      const res = await fetch("/api/admin/nudges/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to draft");
      setDrafts((d) => ({ ...d, [user.email]: data.draft }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to draft");
    } finally {
      setDrafting(null);
    }
  }

  async function handleSend(user: EligibleUser) {
    const message = (drafts[user.email] || "").trim();
    if (!message) return;
    setSending(user.email);
    try {
      const res = await fetch("/api/admin/nudges/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      setSentEmails((s) => new Set(s).add(user.email));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(null);
    }
  }

  async function handleSendAll() {
    if (!confirm(`AI-draft and send a nudge to all ${users.length} eligible users now?`)) return;
    setBatchRunning(true);
    setBatchResult(null);
    try {
      // Admin-triggered batch reuses the per-user draft+send endpoints instead of the cron route
      // (which requires CRON_SECRET) — loop client-side so progress is visible.
      let sent = 0;
      for (const user of users) {
        if (sentEmails.has(user.email)) continue;
        const draftRes = await fetch("/api/admin/nudges/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user }),
        });
        const draftData = await draftRes.json();
        if (!draftRes.ok) continue;
        const sendRes = await fetch("/api/admin/nudges/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email, message: draftData.draft }),
        });
        if (sendRes.ok) {
          sent++;
          setSentEmails((s) => new Set(s).add(user.email));
        }
      }
      setBatchResult(`Sent ${sent} of ${users.length} nudges.`);
    } finally {
      setBatchRunning(false);
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Re-engagement Nudges"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Newsletter", href: "/admin/newsletter/subscribers" }, { label: "Nudges" }]}
      />
      <p className="text-secondary text-sm mb-4 max-w-2xl">
        Inactive, opted-in users not nudged in the last 3 days, with an AI-personalized draft referencing their
        in-progress lesson. The same logic also runs automatically via the daily cron.
      </p>
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={handleSendAll}
          disabled={batchRunning || users.length === 0}
          className="btn-primary text-sm py-2 px-4 disabled:opacity-50"
        >
          {batchRunning ? "Sending…" : "AI-draft & Send All"}
        </button>
        {batchResult && <span className="text-emerald-600 text-sm">{batchResult}</span>}
      </div>

      {loading ? (
        <p className="text-secondary py-8 text-center">Loading eligible users…</p>
      ) : users.length === 0 ? (
        <AdminEmptyState message="No users are currently eligible for a nudge." />
      ) : (
        <div className="space-y-4">
          {users.map((user) => (
            <AdminCard key={user.email}>
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-semibold text-charcoal">{user.displayName || user.email}</p>
                  <p className="text-secondary text-xs">{user.email}</p>
                  <p className="text-secondary text-xs mt-1">
                    Streak: {user.currentStreak} days
                    {user.nextLessonTitle && <> · Next lesson: {user.nextLessonTitle}</>}
                  </p>
                </div>
                {sentEmails.has(user.email) && <span className="text-emerald-600 text-xs font-semibold">Sent</span>}
              </div>
              <textarea
                value={drafts[user.email] || ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [user.email]: e.target.value }))}
                rows={4}
                placeholder="AI-draft or write a nudge message…"
                className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-charcoal text-sm mb-2"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleDraft(user)}
                  disabled={drafting === user.email}
                  className="text-sm py-1.5 px-3 rounded-bento border border-[var(--divider)] text-charcoal hover:bg-base disabled:opacity-50"
                >
                  {drafting === user.email ? "Drafting…" : "AI Draft"}
                </button>
                <button
                  type="button"
                  onClick={() => handleSend(user)}
                  disabled={sending === user.email || !(drafts[user.email] || "").trim()}
                  className="btn-primary text-sm py-1.5 px-3 disabled:opacity-50"
                >
                  {sending === user.email ? "Sending…" : "Send"}
                </button>
              </div>
            </AdminCard>
          ))}
        </div>
      )}
    </div>
  );
}
