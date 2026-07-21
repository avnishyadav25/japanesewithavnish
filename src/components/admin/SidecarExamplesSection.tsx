"use client";

import { useState, useEffect, useCallback } from "react";

type ExampleRow = { id: string; sentence_ja: string; sentence_romaji: string | null; sentence_en: string; notes: string | null };

const QUERY_PARAM: Record<"vocabulary" | "grammar" | "kanji", string> = {
  vocabulary: "vocabularyId",
  grammar: "grammarId",
  kanji: "kanjiId",
};
const BODY_FIELD: Record<"vocabulary" | "grammar" | "kanji", string> = {
  vocabulary: "vocabulary_id",
  grammar: "grammar_id",
  kanji: "kanji_id",
};

/**
 * Example-sentence CRUD for a single vocabulary/grammar/kanji item, scoped by
 * its sidecar-table id. Mirrors the lesson-scoped Examples section already
 * built in LessonLinksSection.tsx, reusing the same /api/admin/examples routes.
 */
export function SidecarExamplesSection({
  contentType,
  sidecarId,
}: {
  contentType: "vocabulary" | "grammar" | "kanji";
  sidecarId: string;
}) {
  const [examples, setExamples] = useState<ExampleRow[]>([]);
  const [form, setForm] = useState({ sentence_ja: "", sentence_romaji: "", sentence_en: "", notes: "" });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/examples?${QUERY_PARAM[contentType]}=${sidecarId}`);
      const data = await res.json().catch(() => []);
      setExamples(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [contentType, sidecarId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addExample() {
    if (!form.sentence_ja.trim() || !form.sentence_en.trim()) return;
    const res = await fetch("/api/admin/examples", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        [BODY_FIELD[contentType]]: sidecarId,
        sentence_ja: form.sentence_ja.trim(),
        sentence_romaji: form.sentence_romaji.trim() || null,
        sentence_en: form.sentence_en.trim(),
        notes: form.notes.trim() || null,
      }),
    });
    if (res.ok) {
      setForm({ sentence_ja: "", sentence_romaji: "", sentence_en: "", notes: "" });
      load();
    }
  }

  async function deleteExample(id: string) {
    await fetch(`/api/admin/examples/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-4 pt-2 border-t border-[var(--divider)]">
      <h3 className="text-sm font-medium text-charcoal">Examples</h3>
      <p className="text-xs text-secondary">Shown on the public lesson page. Aim for 5–10 example sentences.</p>
      <div className="space-y-2">
        {examples.map((ex) => (
          <div key={ex.id} className="flex flex-wrap items-start gap-2 p-3 rounded-bento border border-[var(--divider)] bg-[var(--divider)]/10">
            <div className="flex-1 min-w-[200px] text-sm">
              <div className="text-charcoal">{ex.sentence_ja}</div>
              {ex.sentence_romaji && <div className="text-secondary text-xs">{ex.sentence_romaji}</div>}
              <div className="text-secondary text-xs">{ex.sentence_en}</div>
            </div>
            <button
              type="button"
              onClick={() => deleteExample(ex.id)}
              className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-bento border border-[var(--divider)]"
            >
              Remove
            </button>
          </div>
        ))}
        {examples.length === 0 && !loading && <p className="text-secondary text-xs italic">No examples yet.</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-bento border border-[var(--divider)]">
        <input
          type="text"
          placeholder="Japanese"
          value={form.sentence_ja}
          onChange={(e) => setForm((f) => ({ ...f, sentence_ja: e.target.value }))}
          className="px-3 py-2 border border-[var(--divider)] rounded-bento text-charcoal text-sm"
        />
        <input
          type="text"
          placeholder="Romaji (optional)"
          value={form.sentence_romaji}
          onChange={(e) => setForm((f) => ({ ...f, sentence_romaji: e.target.value }))}
          className="px-3 py-2 border border-[var(--divider)] rounded-bento text-charcoal text-sm"
        />
        <input
          type="text"
          placeholder="English translation"
          value={form.sentence_en}
          onChange={(e) => setForm((f) => ({ ...f, sentence_en: e.target.value }))}
          className="px-3 py-2 border border-[var(--divider)] rounded-bento text-charcoal text-sm sm:col-span-2"
        />
        <button
          type="button"
          onClick={addExample}
          disabled={loading}
          className="px-4 py-2 text-sm border border-[var(--divider)] rounded-bento text-charcoal hover:bg-[var(--divider)]/20 sm:col-span-2"
        >
          Add example
        </button>
      </div>
    </div>
  );
}
