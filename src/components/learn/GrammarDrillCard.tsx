"use client";

import { useCallback, useMemo, useState } from "react";

type GrammarDrillItem = {
  id: string;
  sentenceJa: string;
  correctAnswers: string[];
  distractors: string[];
  hint?: string | null;
};

export function GrammarDrillCard({
  item,
  onResponse,
}: {
  item: GrammarDrillItem;
  onResponse?: (correct: boolean, responseTimeMs: number) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [startTime] = useState(() => Date.now());

  const gap = "__";
  const parts = item.sentenceJa.split(gap);
  const correct = item.correctAnswers[0] ?? "";

  const options = useMemo(() => {
    const all = [correct, ...(item.distractors || [])].filter(Boolean);
    const deduped = all.filter((v, idx, arr) => arr.indexOf(v) === idx);
    return deduped.sort(() => Math.random() - 0.5);
  }, [correct, item.distractors]);

  const handleSelect = useCallback(
    (opt: string) => {
      if (revealed) return;
      setSelected(opt);
      setRevealed(true);
      const responseTimeMs = Date.now() - startTime;
      const isCorrect = opt === correct;
      onResponse?.(isCorrect, responseTimeMs);
      fetch("/api/learn/grammar-drills/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drillId: item.id, correct: isCorrect, responseTimeMs }),
      }).catch(() => {});
    },
    [revealed, correct, item.id, startTime, onResponse]
  );

  return (
    <div className="rounded-bento border border-[var(--divider)] bg-white p-4 space-y-3">
      <p className="text-charcoal text-lg">
        {parts[0]}
        <span className="inline-flex items-center gap-1 min-w-[80px] align-baseline">
          {!revealed ? (
            options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => handleSelect(opt)}
                className="px-2 py-1 border border-[var(--divider)] rounded hover:bg-[var(--divider)]/20 text-charcoal"
              >
                {opt}
              </button>
            ))
          ) : (
            <span className={selected === correct ? "text-green-600 font-medium" : "text-primary"}>
              {selected}
              {selected !== correct && ` (correct: ${correct})`}
            </span>
          )}
        </span>
        {parts[1]}
      </p>
      {item.hint && (
        <details className="text-sm text-secondary">
          <summary className="cursor-pointer">Hint</summary>
          <p className="mt-1">{item.hint}</p>
        </details>
      )}
    </div>
  );
}
