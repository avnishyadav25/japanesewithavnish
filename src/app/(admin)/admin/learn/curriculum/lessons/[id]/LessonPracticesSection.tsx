"use client";

import { useState, useEffect, useCallback } from "react";

type Practice = {
  id: string;
  lesson_id: string;
  title: string;
  description: string | null;
  practice_type: string | null;
  content_data: any;
  sort_order: number;
  estimated_minutes: number | null;
  created_at: string;
  updated_at: string;
};

const PRACTICE_TYPES = [
  { value: "writing_canvas", label: "Writing Canvas (Kana/Kanji trace) ✍️" },
  { value: "mcq", label: "Multiple Choice Quiz ❓" },
  { value: "fill_blank", label: "Fill-in-the-blank ✏️" },
  { value: "roleplay", label: "Roleplay Dialogue 💬" },
  { value: "listening", label: "Listening Drill 🎧" },
  { value: "shadowing", label: "Shadowing / Voice drill 🔊" },
  { value: "module_checkpoint", label: "Module Checkpoint 🚩" },
  { value: "level_assessment", label: "Level Assessment 🏆" },
];

export function LessonPracticesSection({ lessonId }: { lessonId: string }) {
  const [practices, setPractices] = useState<Practice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [practiceType, setPracticeType] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [contentData, setContentData] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/curriculum/lessons/${lessonId}/practices`);
      if (!res.ok) throw new Error("Failed to load practices");
      const data = await res.json();
      setPractices(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || "Failed to load practices");
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPracticeType("mcq");
    setEstimatedMinutes("10");
    setSortOrder("0");
    setContentData("{}");
    setEditingId(null);
    setError("");
  };

  const startEdit = (p: Practice) => {
    setEditingId(p.id);
    setTitle(p.title);
    setDescription(p.description ?? "");
    setPracticeType(p.practice_type ?? "mcq");
    setEstimatedMinutes(String(p.estimated_minutes ?? 10));
    setSortOrder(String(p.sort_order ?? 0));
    setContentData(p.content_data ? JSON.stringify(p.content_data, null, 2) : "{}");
  };

  const startAdd = () => {
    resetForm();
    setEditingId("new");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    let parsedContent = null;
    try {
      if (contentData.trim()) {
        parsedContent = JSON.parse(contentData);
      }
    } catch {
      setError("Invalid JSON format in content data");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      practice_type: practiceType || null,
      sort_order: parseInt(sortOrder, 10) || 0,
      estimated_minutes: parseInt(estimatedMinutes, 10) || null,
      content_data: parsedContent,
    };

    try {
      const url = editingId === "new"
        ? `/api/admin/curriculum/lessons/${lessonId}/practices`
        : `/api/admin/curriculum/lessons/${lessonId}/practices/${editingId}`;
      
      const method = editingId === "new" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Save failed");
      }

      resetForm();
      await load();
    } catch (err: any) {
      setError(err.message || "Failed to save practice");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pid: string) => {
    if (!confirm("Are you sure you want to delete this practice item?")) return;
    setError("");
    try {
      const res = await fetch(`/api/admin/curriculum/lessons/${lessonId}/practices/${pid}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Delete failed");
      }
      await load();
    } catch (err: any) {
      setError(err.message || "Failed to delete practice");
    }
  };

  if (loading) return <p className="text-secondary text-sm">Loading practices…</p>;

  return (
    <div className="space-y-4 w-full bg-white p-6 rounded-bento border border-[var(--divider)] shadow-xs">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold text-charcoal text-base">Lesson Practices</h3>
        {editingId === null && (
          <button
            type="button"
            onClick={startAdd}
            className="px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-bento hover:bg-primary/95 transition"
          >
            + Add Practice
          </button>
        )}
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {editingId !== null ? (
        <form onSubmit={handleSave} className="space-y-3 bg-[var(--divider)]/10 p-4 rounded-bento text-sm border border-[var(--divider)]/40">
          <h4 className="font-semibold text-charcoal">{editingId === "new" ? "New Practice Item" : "Edit Practice Item"}</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-charcoal mb-1">Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-2 py-1.5 border border-[var(--divider)] rounded-bento text-xs bg-white" placeholder="e.g. Hiragana Recognition Quiz" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-charcoal mb-1">Practice Type</label>
              <select value={practiceType} onChange={(e) => setPracticeType(e.target.value)} className="w-full px-2 py-1.5 border border-[var(--divider)] rounded-bento text-xs bg-white">
                {PRACTICE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-charcoal mb-1">Instructions / Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full px-2 py-1.5 border border-[var(--divider)] rounded-bento text-xs bg-white" placeholder="Directions for the student..." />
          </div>

          <div className="grid grid-cols-2 gap-3 max-w-xs">
            <div>
              <label className="block text-xs font-medium text-charcoal mb-1">Est. Minutes</label>
              <input type="number" value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(e.target.value)} className="w-full px-2 py-1.5 border border-[var(--divider)] rounded-bento text-xs bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-charcoal mb-1">Sort Order</label>
              <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="w-full px-2 py-1.5 border border-[var(--divider)] rounded-bento text-xs bg-white" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-charcoal mb-1">Content Data (JSON payload for questions, choices, traces)</label>
            <textarea value={contentData} onChange={(e) => setContentData(e.target.value)} rows={6} className="w-full px-2 py-1.5 border border-[var(--divider)] rounded-bento text-xs font-mono bg-white" placeholder={`{\n  "questions": []\n}`} />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-bento hover:bg-primary/95 transition">
              {saving ? "Saving…" : "Save Practice"}
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2 border border-[var(--divider)] text-charcoal text-xs font-bold rounded-bento bg-white hover:bg-gray-50 transition">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-2">
          {practices.length === 0 ? (
            <p className="text-secondary text-xs italic">No practices added to this lesson yet.</p>
          ) : (
            <div className="divide-y divide-[var(--divider)]/40 border border-[var(--divider)]/50 rounded-bento overflow-hidden bg-[var(--divider)]/5">
              {practices.map((p) => {
                const typeLabel = PRACTICE_TYPES.find((t) => t.value === p.practice_type)?.label || p.practice_type;
                return (
                  <div key={p.id} className="p-4 flex items-center justify-between hover:bg-white transition gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-primary">{typeLabel}</span>
                        {p.estimated_minutes && (
                          <span className="text-[10px] bg-charcoal/5 px-2 py-0.5 rounded-full text-secondary">⏱ {p.estimated_minutes} min</span>
                        )}
                        <span className="text-[10px] text-secondary">Sort: {p.sort_order}</span>
                      </div>
                      <h4 className="font-heading text-sm font-bold text-charcoal">{p.title}</h4>
                      {p.description && <p className="text-xs text-secondary mt-1">{p.description}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(p)}
                        className="px-2.5 py-1 text-xs border border-primary/20 text-primary bg-primary/5 hover:bg-primary/10 rounded-bento font-semibold transition"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id)}
                        className="px-2.5 py-1 text-xs border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 rounded-bento font-semibold transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
