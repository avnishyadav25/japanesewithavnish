"use client";

import { useCallback, useMemo, useState } from "react";

export type GlossaryEntry = {
  id: string;
  segmentText: string;
  segmentStart: number;
  segmentEnd: number;
  definitionText: string | null;
  vocabularyId: string | null;
  grammarId: string | null;
};

type ReadingSandboxProps = {
  content: string;
  glossary: GlossaryEntry[];
  className?: string;
};

/** Renders reading content with tappable segments; shows definition in a tooltip/popover on tap. */
export function ReadingSandbox({ content, glossary, className = "" }: ReadingSandboxProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const segments = useMemo(() => {
    if (glossary.length === 0) return [{ type: "text" as const, start: 0, end: content.length, text: content, entry: null }];
    const sorted = [...glossary].sort((a, b) => a.segmentStart - b.segmentStart);
    const out: { type: "text" | "term"; start: number; end: number; text: string; entry: GlossaryEntry | null }[] = [];
    let pos = 0;
    for (const g of sorted) {
      if (g.segmentStart > pos) {
        out.push({ type: "text", start: pos, end: g.segmentStart, text: content.slice(pos, g.segmentStart), entry: null });
      }
      out.push({ type: "term", start: g.segmentStart, end: g.segmentEnd, text: g.segmentText, entry: g });
      pos = g.segmentEnd;
    }
    if (pos < content.length) {
      out.push({ type: "text", start: pos, end: content.length, text: content.slice(pos), entry: null });
    }
    return out;
  }, [content, glossary]);

  const handleTap = useCallback((entry: GlossaryEntry | null) => {
    setActiveId(entry?.id ?? null);
  }, []);

  return (
    <div className={`relative ${className}`}>
      <div className="prose prose-charcoal max-w-none text-charcoal leading-relaxed">
        {segments.map((seg, i) =>
          seg.type === "term" && seg.entry ? (
            <span
              key={seg.entry.id}
              role="button"
              tabIndex={0}
              onClick={() => handleTap(seg.entry)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleTap(seg.entry); } }}
              className="border-b border-primary/50 cursor-pointer hover:bg-primary/10 px-0.5 rounded"
              aria-label={`Definition: ${seg.entry.definitionText || seg.text}`}
            >
              {seg.text}
            </span>
          ) : (
            <span key={i}>{seg.text}</span>
          )
        )}
      </div>
      {activeId && (() => {
        const entry = glossary.find((g) => g.id === activeId);
        if (!entry) return null;
        const def = entry.definitionText || entry.segmentText;
        return (
          <div
            className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm bg-charcoal text-white p-4 rounded-bento shadow-lg z-50"
            role="dialog"
            aria-label="Definition"
          >
            <p className="font-medium text-sm">{entry.segmentText}</p>
            <p className="text-sm mt-1 opacity-90">{def}</p>
            <button
              type="button"
              onClick={() => setActiveId(null)}
              className="mt-2 text-sm text-primary font-medium hover:underline"
            >
              Close
            </button>
          </div>
        );
      })()}
    </div>
  );
}
