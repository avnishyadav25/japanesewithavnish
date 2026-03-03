"use client";

import { useState, useCallback, useEffect } from "react";
import { AdminCard } from "@/components/admin/AdminCard";

type Message = { role: "user" | "assistant"; content: string };

export function AdminChatTest() {
  const [sessionId] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    const userMsg: Message = { role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setLoading(true);
    try {
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ messages: history, session_id: sessionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Chat failed");
        return;
      }
      const reply = (data.reply ?? "").trim();
      if (reply) setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, sessionId]);

  return (
    <AdminCard>
      <h2 className="font-heading font-bold text-charcoal mb-2">Test chat</h2>
      <p className="text-secondary text-sm mb-4">
        Talk to japani-bhai here. This session is logged (see Session logs below).
      </p>
      <div className="border border-[var(--divider)] rounded-bento overflow-hidden bg-[var(--base)]">
        <div className="h-64 overflow-y-auto p-3 space-y-3">
          {messages.length === 0 && (
            <p className="text-secondary text-sm">Send a message to start. Replies are logged per session.</p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-bento px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-primary text-white"
                    : "bg-white border border-[var(--divider)] text-charcoal"
                }`}
              >
                <span className="font-medium text-xs opacity-80 mr-2">{m.role === "user" ? "You" : "japani-bhai"}</span>
                <span className="whitespace-pre-wrap">{m.content}</span>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-bento px-3 py-2 text-sm bg-white border border-[var(--divider)] text-secondary">
                …
              </div>
            </div>
          )}
        </div>
        <div className="p-2 border-t border-[var(--divider)] flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Type a message…"
            className="flex-1 rounded-bento border border-[var(--divider)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            disabled={loading}
          />
          <button
            type="button"
            onClick={send}
            disabled={loading || !input.trim()}
            className="btn-primary text-sm py-2"
          >
            Send
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <p className="mt-2 text-xs text-secondary">Session: {sessionId.slice(0, 8)}…</p>
    </AdminCard>
  );
}

type SessionSummary = { session_id: string; admin_email: string; started_at: string; message_count: number };

export function AdminChatSessionLogs() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: string; content: string; created_at: string }[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/chatbot-context/logs", { credentials: "include" });
      const data = await res.json();
      if (res.ok) setSessions(data.sessions ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleSession = useCallback(async (sessionId: string) => {
    if (expandedId === sessionId) {
      setExpandedId(null);
      setMessages([]);
      return;
    }
    setExpandedId(sessionId);
    setMessagesLoading(true);
    try {
      const res = await fetch(`/api/admin/chatbot-context/logs/${sessionId}`, { credentials: "include" });
      const data = await res.json();
      if (res.ok) setMessages(data.messages ?? []);
    } finally {
      setMessagesLoading(false);
    }
  }, [expandedId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  return (
    <AdminCard>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading font-bold text-charcoal">Session logs</h2>
        <button
          type="button"
          onClick={loadSessions}
          disabled={loading}
          className="text-sm text-secondary hover:text-primary"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>
      <p className="text-secondary text-sm mb-4">
        Recent test chat sessions. Expand to see the full conversation.
      </p>
      {loading ? (
        <p className="text-secondary text-sm">Loading sessions…</p>
      ) : sessions.length === 0 ? (
        <p className="text-secondary text-sm">No sessions yet. Use Test chat above to create one.</p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li key={s.session_id} className="border border-[var(--divider)] rounded-bento overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSession(s.session_id)}
                className="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-[var(--base)]"
              >
                <span className="text-sm font-mono text-secondary">{s.session_id.slice(0, 8)}…</span>
                <span className="text-xs text-secondary">
                  {new Date(s.started_at).toLocaleString()} · {s.message_count} msgs
                </span>
              </button>
              {expandedId === s.session_id && (
                <div className="border-t border-[var(--divider)] p-3 bg-[var(--base)] max-h-64 overflow-y-auto space-y-2">
                  {messagesLoading ? (
                    <p className="text-secondary text-sm">Loading…</p>
                  ) : (
                    messages.map((m, i) => (
                      <div key={i} className="text-sm">
                        <span className="font-medium text-secondary">{m.role}:</span>{" "}
                        <span className="whitespace-pre-wrap">{m.content}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </AdminCard>
  );
}
