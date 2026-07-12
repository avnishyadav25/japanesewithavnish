"use client";

import { useState, useEffect, useCallback } from "react";

type Objective = {
  id: string;
  lesson_id: string;
  objective_text: string;
  sort_order: number;
};

export function LessonObjectivesSection({ lessonId }: { lessonId: string }) {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/curriculum/lessons/${lessonId}/objectives`);
    const data = await res.json();
    setObjectives(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [lessonId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addObjective(e: React.FormEvent) {
    e.preventDefault();
    if (!newText.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/curriculum/lessons/${lessonId}/objectives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective_text: newText.trim() }),
      });
      if (res.ok) {
        setNewText("");
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(id: string) {
    if (!editingText.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/curriculum/lessons/${lessonId}/objectives/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective_text: editingText.trim() }),
      });
      if (res.ok) {
        setEditingId(null);
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteObjective(id: string) {
    if (!confirm("Delete this learning objective?")) return;
    const res = await fetch(`/api/admin/curriculum/lessons/${lessonId}/objectives/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= objectives.length) return;
    const a = objectives[index];
    const b = objectives[target];
    await Promise.all([
      fetch(`/api/admin/curriculum/lessons/${lessonId}/objectives/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: b.sort_order }),
      }),
      fetch(`/api/admin/curriculum/lessons/${lessonId}/objectives/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sort_order: a.sort_order }),
      }),
    ]);
    await load();
  }

  if (loading) return <p className="text-secondary text-sm">Loading objectives…</p>;

  return (
    <div className="space-y-4 w-full bg-white p-6 rounded-bento border border-[var(--divider)] shadow-xs">
      <h3 className="font-heading font-semibold text-charcoal text-base">Learning Objectives</h3>
      <p className="text-secondary text-xs -mt-2">What a student should be able to do after completing this lesson.</p>

      {objectives.length === 0 ? (
        <p className="text-secondary text-xs italic">No objectives added yet.</p>
      ) : (
        <ul className="space-y-2">
          {objectives.map((o, i) => (
            <li key={o.id} className="flex items-start gap-2 border border-[var(--divider)] rounded-bento p-2.5">
              <span className="text-primary font-bold text-sm mt-0.5">✓</span>
              {editingId === o.id ? (
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    className="flex-1 px-2 py-1 border border-[var(--divider)] rounded-bento text-xs"
                    autoFocus
                  />
                  <button type="button" onClick={() => saveEdit(o.id)} disabled={saving} className="text-xs font-bold text-primary">Save</button>
                  <button type="button" onClick={() => setEditingId(null)} className="text-xs text-secondary">Cancel</button>
                </div>
              ) : (
                <>
                  <span className="flex-1 text-sm text-charcoal">{o.objective_text}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="px-1 text-secondary hover:text-charcoal disabled:opacity-30 text-xs">↑</button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === objectives.length - 1} className="px-1 text-secondary hover:text-charcoal disabled:opacity-30 text-xs">↓</button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(o.id);
                        setEditingText(o.objective_text);
                      }}
                      className="text-xs text-primary hover:underline"
                    >
                      Edit
                    </button>
                    <button type="button" onClick={() => deleteObjective(o.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addObjective} className="flex gap-2 pt-2 border-t border-[var(--divider)]">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="e.g. Recognize and write all 46 basic hiragana characters"
          className="flex-1 px-3 py-2 border border-[var(--divider)] rounded-bento text-xs"
        />
        <button type="submit" disabled={saving || !newText.trim()} className="px-3 py-2 bg-primary text-white text-xs font-bold rounded-bento hover:bg-primary/95 transition disabled:opacity-50">
          + Add
        </button>
      </form>
    </div>
  );
}
