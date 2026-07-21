"use client";

import { WritingCanvas } from "@/components/learn/WritingCanvas";

/**
 * Admin-side stroke practice for a kanji being edited — reuses the same
 * interactive tracing canvas learners get on the public site, so admins can
 * verify stroke order/count directly in the editor instead of a static image.
 */
export function KanjiStrokePreview({
  character,
  strokeCount,
  reading,
}: {
  character: string;
  strokeCount: number | null;
  reading: string | null;
}) {
  return (
    <div className="space-y-2 pt-2 border-t border-[var(--divider)]">
      <h3 className="text-sm font-medium text-charcoal">Stroke order practice</h3>
      <p className="text-xs text-secondary">Trace the character to verify stroke order/count against KanjiVG data.</p>
      <WritingCanvas character={character} characterType="kanji" expectedStrokeCount={strokeCount} reading={reading} />
    </div>
  );
}
