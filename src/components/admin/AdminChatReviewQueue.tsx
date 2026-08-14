"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminCard } from "@/components/admin/AdminCard";

type LogRow = {
  id: string;
  session_id: string;
  admin_email: string;
  role: string;
  content: string;
  created_at: string;
  flagged?: boolean;
  rating?: number | null;
};

export function AdminChatReviewQueue() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/chat-logs?flagged=${showFlaggedOnly}&limit=20`,
        { credentials: "include" }
      );
      const data = await res.json();
      setLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [showFlaggedOnly]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleFlag(id: string, current: boolean) {
    try {
      const res = await fetch(`/api/admin/chat-logs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ flagged: !current }),
      });
      if (res.ok) load();
    } catch {
      // ignore
    }
  }

  return (
    <AdminCard>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading font-bold text-charcoal">AI review queue</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-secondary flex items-center gap-1">
            <input
              type="checkbox"
              checked={showFlaggedOnly}
              onChange={(e) => setShowFlaggedOnly(e.target.checked)}
              className="rounded border-[var(--divider)]"
            />
            Flagged only
          </label>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="text-sm text-primary hover:underline"
          >
            Refresh
          </button>
        </div>
      </div>
      <p className="text-secondary text-sm mb-4">
        Recent chat log entries. Flag items for human review (e.g. low quality or wrong answer).
      </p>
      {loading ? (
        <p className="text-secondary text-sm">Loading…</p>
      ) : logs.length === 0 ? (
        <p className="text-secondary text-sm">
          {showFlaggedOnly ? "No flagged entries." : "No chat logs yet. Use Test chat above."}
        </p>
      ) : (
        <ul className="space-y-2 max-h-80 overflow-y-auto">
          {logs.map((log) => (
            <li
              key={log.id}
              className={`border rounded-bento p-3 text-sm ${log.flagged ? "border-primary bg-primary/5" : "border-[var(--divider)]"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-secondary">{log.role}</span>
                  <span className="text-secondary text-xs ml-2">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                  <p className="whitespace-pre-wrap mt-1 text-charcoal">{log.content.slice(0, 300)}{log.content.length > 300 ? "…" : ""}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleFlag(log.id, Boolean(log.flagged))}
                  className="shrink-0 text-xs px-2 py-1 rounded border border-[var(--divider)] hover:border-primary hover:text-primary"
                >
                  {log.flagged ? "Unflag" : "Flag"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminCard>
  );
}
