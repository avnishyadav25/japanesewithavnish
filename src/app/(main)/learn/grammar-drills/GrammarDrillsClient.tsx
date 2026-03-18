"use client";

import { useEffect, useState } from "react";
import { GrammarDrillCard } from "@/components/learn/GrammarDrillCard";

type DrillItem = {
  id: string;
  sentenceJa: string;
  correctAnswers: string[];
  distractors: string[];
  hint: string | null;
  sortOrder: number;
};

export function GrammarDrillsClient({
  lessonId,
  grammarId,
}: {
  lessonId?: string;
  grammarId?: string;
}) {
  const [items, setItems] = useState<DrillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const q = lessonId ? `?lessonId=${encodeURIComponent(lessonId)}` : grammarId ? `?grammarId=${encodeURIComponent(grammarId)}` : "";
    if (!q) {
      setLoading(false);
      setItems([]);
      return;
    }
    setLoading(true);
    fetch(`/api/learn/grammar-drills${q}`)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data.items) ? data.items : [];
        setItems(list.map((d: DrillItem) => ({ ...d, hint: d.hint ?? null })));
        setIndex(0);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [lessonId, grammarId]);

  if (!lessonId && !grammarId) {
    return (
      <div className="rounded-bento border border-[var(--divider)] bg-white p-6 text-center text-secondary">
        <p>Open drills from a lesson page (e.g. /learn/grammar-drills?lessonId=...) or a grammar point (?grammarId=...).</p>
      </div>
    );
  }

  if (loading) return <p className="text-secondary text-sm">Loading…</p>;
  if (items.length === 0) return <p className="text-secondary text-sm">No drills for this lesson or grammar yet.</p>;

  const current = items[index];
  return (
    <div className="space-y-4">
      <p className="text-sm text-secondary">Drill {index + 1} of {items.length}</p>
      {current && (
        <GrammarDrillCard
          item={current}
          onResponse={() => {}}
        />
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="px-3 py-1.5 border border-[var(--divider)] rounded-bento text-sm disabled:opacity-50"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(items.length - 1, i + 1))}
          disabled={index >= items.length - 1}
          className="px-3 py-1.5 border border-[var(--divider)] rounded-bento text-sm disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
