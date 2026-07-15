"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GrammarDrillCard } from "@/components/learn/GrammarDrillCard";

type DrillItem = {
  id: string;
  sentenceJa: string;
  correctAnswers: string[];
  distractors: string[];
  hint: string | null;
  sortOrder: number;
};

const SAMPLE_COUNT = 3;

export function GrammarDrillsPreview() {
  const [items, setItems] = useState<DrillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState(0);

  useEffect(() => {
    fetch(`/api/learn/grammar-drills?sample=${SAMPLE_COUNT}`)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data.items) ? data.items : [];
        setItems(list.map((d: DrillItem) => ({ ...d, hint: d.hint ?? null })));
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-secondary text-sm">Loading sample questions…</p>;
  if (items.length === 0) return <p className="text-secondary text-sm">No sample drills available right now.</p>;

  const done = answered >= items.length;

  if (done) {
    return (
      <div className="rounded-bento border border-[var(--divider)] bg-white p-6 text-center space-y-3">
        <p className="text-charcoal font-medium">
          Nice work! Create a free account to save your score and continue practising.
        </p>
        <Link
          href="/login?tab=signup&redirect=/learn/grammar-drills"
          className="inline-block px-5 py-2.5 bg-primary hover:bg-primary/95 text-white text-sm font-bold rounded-xl transition"
        >
          Create a free account
        </Link>
      </div>
    );
  }

  const current = items[index];
  return (
    <div className="space-y-4">
      <p className="text-sm text-secondary">Sample question {index + 1} of {items.length}</p>
      {current && (
        <GrammarDrillCard
          key={current.id}
          item={current}
          onResponse={() => {
            setAnswered((a) => a + 1);
            if (index < items.length - 1) {
              setTimeout(() => setIndex((i) => i + 1), 900);
            }
          }}
        />
      )}
    </div>
  );
}
