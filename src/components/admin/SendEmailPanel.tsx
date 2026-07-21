"use client";

import { useEffect, useState } from "react";

type Template = { key: string; subject: string };

/** Manual + template-based email sending to one user, with a mandatory preview step before
 * Send unlocks — decision #7 of the admin panel overhaul ("each with a preview step"). */
export function SendEmailPanel({ email }: { email: string }) {
  const [mode, setMode] = useState<"manual" | "template">("manual");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateKey, setTemplateKey] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState<{ subject: string; bodyHtml: string } | null>(null);
  const [loading, setLoading] = useState<"preview" | "send" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetch("/api/admin/email-templates")
      .then((r) => r.json())
      .then((d) => setTemplates(Array.isArray(d.templates) ? d.templates : []))
      .catch(() => setTemplates([]));
  }, []);

  function resetPreview() {
    setPreview(null);
    setMessage(null);
  }

  async function runAction(action: "preview" | "send") {
    setLoading(action);
    setMessage(null);
    try {
      const payload =
        mode === "template"
          ? { mode, templateKey, vars: { name: email.split("@")[0] }, action }
          : { mode, subject, body, action };
      const res = await fetch(`/api/admin/students/${encodeURIComponent(email)}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      if (action === "preview") {
        setPreview({ subject: data.subject, bodyHtml: data.bodyHtml });
      } else {
        setMessage("✅ Email sent");
        setPreview(null);
        setSubject("");
        setBody("");
        setTemplateKey("");
        setRefreshKey((k) => k + 1);
      }
    } catch (e) {
      setMessage(`❌ ${e instanceof Error ? e.message : "Failed"}`);
    } finally {
      setLoading(null);
    }
  }

  const canPreview = mode === "template" ? Boolean(templateKey) : Boolean(subject.trim() && body.trim());

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setMode("manual"); resetPreview(); }}
          className={`px-3 py-1.5 rounded-bento text-xs font-semibold border ${mode === "manual" ? "bg-charcoal text-white border-charcoal" : "border-[var(--divider)] text-charcoal"}`}
        >
          Manual
        </button>
        <button
          type="button"
          onClick={() => { setMode("template"); resetPreview(); }}
          className={`px-3 py-1.5 rounded-bento text-xs font-semibold border ${mode === "template" ? "bg-charcoal text-white border-charcoal" : "border-[var(--divider)] text-charcoal"}`}
        >
          Template
        </button>
      </div>

      {mode === "manual" ? (
        <div className="space-y-2">
          <input
            type="text"
            value={subject}
            onChange={(e) => { setSubject(e.target.value); resetPreview(); }}
            placeholder="Subject"
            className="w-full h-9 px-3 border border-[var(--divider)] rounded-xl text-xs"
          />
          <textarea
            value={body}
            onChange={(e) => { setBody(e.target.value); resetPreview(); }}
            placeholder="Message"
            rows={4}
            className="w-full px-3 py-2 border border-[var(--divider)] rounded-xl text-xs"
          />
        </div>
      ) : (
        <select
          value={templateKey}
          onChange={(e) => { setTemplateKey(e.target.value); resetPreview(); }}
          className="w-full h-9 px-3 border border-[var(--divider)] rounded-xl text-xs bg-white"
        >
          <option value="">Select a template…</option>
          {templates.map((t) => (
            <option key={t.key} value={t.key}>{t.key} — {t.subject}</option>
          ))}
        </select>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => runAction("preview")}
          disabled={!canPreview || loading !== null}
          className="flex-1 h-9 border border-[var(--divider)] hover:border-charcoal text-charcoal rounded-xl text-xs font-bold font-heading disabled:opacity-50"
        >
          {loading === "preview" ? "Loading…" : "Preview"}
        </button>
        <button
          type="button"
          onClick={() => runAction("send")}
          disabled={!preview || loading !== null}
          className="flex-1 h-9 bg-primary text-white rounded-xl text-xs font-bold font-heading disabled:opacity-50"
        >
          {loading === "send" ? "Sending…" : "Send"}
        </button>
      </div>

      {message && <p className="text-xs font-semibold">{message}</p>}

      {preview && (
        <div className="border border-[var(--divider)] rounded-xl overflow-hidden">
          <div className="bg-[var(--base)] px-3 py-1.5 text-[10px] font-bold uppercase text-secondary">
            Preview — {preview.subject}
          </div>
          <iframe title="Email preview" srcDoc={preview.bodyHtml} className="w-full h-72 bg-white" />
        </div>
      )}

      <EmailLog email={email} refreshKey={refreshKey} />
    </div>
  );
}

type LogRow = { id: string; sent_by_admin_email: string; template_key: string | null; subject: string; status: string; sent_at: string };

function EmailLog({ email, refreshKey }: { email: string; refreshKey: number }) {
  const [rows, setRows] = useState<LogRow[]>([]);

  useEffect(() => {
    fetch(`/api/admin/students/${encodeURIComponent(email)}/email-log`)
      .then((r) => r.json())
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]));
  }, [email, refreshKey]);

  if (rows.length === 0) return <p className="text-[10px] text-secondary italic">No emails sent yet.</p>;

  return (
    <div className="border-t border-[var(--divider)] pt-3 space-y-1.5">
      <p className="text-[10px] font-bold uppercase text-secondary">Email history</p>
      {rows.map((r) => (
        <div key={r.id} className="text-xs border border-[var(--divider)] rounded-xl px-3 py-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-charcoal font-medium truncate">{r.subject}</p>
            <p className="text-secondary text-[10px]">
              {r.template_key ? `Template: ${r.template_key}` : "Manual"} · by {r.sent_by_admin_email} · {new Date(r.sent_at).toLocaleString()}
            </p>
          </div>
          <span className={`shrink-0 text-[10px] font-bold uppercase ${r.status === "sent" ? "text-emerald-600" : "text-red-600"}`}>{r.status}</span>
        </div>
      ))}
    </div>
  );
}
