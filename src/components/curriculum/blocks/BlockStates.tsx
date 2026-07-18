/** Shared "empty" state for blocks whose resolved FK array came back empty — e.g. a referenced
 * vocabulary/kanji/lesson row was deleted after the block was authored. Renders a visibly
 * different placeholder instead of a silently blank card, so a missing reference reads as a
 * content gap rather than a rendering bug. Locked-block state has its own component
 * (LockedBlockPlaceholder) since it needs a real unlock CTA, not just a message. */
export function EmptyBlockState({ label }: { label: string }) {
  return (
    <div className="bg-[#FAF8F5] border border-dashed border-[var(--divider)] rounded-bento p-5 text-center">
      <p className="text-secondary text-xs italic">{label}</p>
    </div>
  );
}
