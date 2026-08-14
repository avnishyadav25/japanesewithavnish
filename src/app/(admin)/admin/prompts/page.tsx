"use client";

import { useState, useEffect } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

type PromptRow = { key: string; content: string; updated_at: string };

const TEMPLATE_HINTS: Record<string, string> = {
  next_steps: "Placeholders: {{level}}, {{streak}}, {{dueCount}}, {{learnedCount}}, {{totalPoints}}",
  daily_checkpoint: "Placeholders: {{level}}, {{streak}}, {{pointsToday}}, {{dueCount}}",
};

export default function AdminPromptsPage() {
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PromptRow | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/prompts");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setPrompts(data.prompts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load prompts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave() {
    if (!editing?.key || !editContent.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/prompts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: editing.key, content: editContent.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to save");
      }
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(p: PromptRow) {
    setEditing(p);
    setEditContent(p.content);
    setError("");
  }

  const truncate = (s: string, len: number) => (s.length <= len ? s : s.slice(0, len) + "…");

  return (
    <div>
      <AdminPageHeader
        title="Manage AI Prompts"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Manage AI Prompts" }]}
      />
      <p className="text-secondary text-sm mb-6">
        Edit prompts used by the tutor, correct-sentence, next-steps, daily-checkpoint, and blog-summary. Changes take effect on the next request.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-bento bg-red-50 border border-red-200 text-red-800 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-secondary">Loading…</p>
      ) : prompts.length === 0 ? (
        <AdminEmptyState message="No prompts found. Run the 033_ai_prompts migration to seed the table." />
      ) : (
        <AdminCard>
          <AdminTable headers={["Key", "Content (preview)", "Updated", "Actions"]}>
            {prompts.map((p) => (
              <tr key={p.key} className="border-b border-[var(--divider)]">
                <td className="py-2 px-2 font-medium text-charcoal">{p.key}</td>
                <td className="py-2 px-2 text-secondary font-mono text-xs max-w-[320px]">
                  {truncate(p.content, 120)}
                </td>
                <td className="py-2 px-2 text-secondary text-xs">
                  {p.updated_at ? new Date(p.updated_at).toLocaleString() : "—"}
                </td>
                <td className="py-2 px-2">
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="text-primary hover:underline text-sm font-medium"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      )}

      {(TEMPLATE_HINTS.next_steps || TEMPLATE_HINTS.daily_checkpoint) && (
        <p className="text-secondary text-xs mt-4">
          Template prompts (next_steps, daily_checkpoint): use placeholders as listed in the edit form below.
        </p>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/40">
          <div className="bg-white rounded-bento shadow-card border border-[var(--divider)] max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-[var(--divider)] flex items-center justify-between">
              <h2 className="font-heading font-bold text-charcoal">Edit: {editing.key}</h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="p-2 text-secondary hover:text-charcoal"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {TEMPLATE_HINTS[editing.key] && (
              <div className="px-4 py-2 bg-primary/5 text-primary text-xs border-b border-[var(--divider)]">
                {TEMPLATE_HINTS[editing.key]}
              </div>
            )}
            <div className="p-4 flex-1 min-h-0 overflow-hidden flex flex-col">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full flex-1 min-h-[200px] p-3 border-2 border-[var(--divider)] rounded-bento text-charcoal font-mono text-sm focus:border-primary focus:outline-none resize-y"
                placeholder="Prompt content…"
                spellCheck={false}
              />
            </div>
            <div className="p-4 border-t border-[var(--divider)] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-bento border-2 border-[var(--divider)] text-charcoal hover:border-primary hover:text-primary transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !editContent.trim()}
                className="btn-primary px-4 py-2 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
