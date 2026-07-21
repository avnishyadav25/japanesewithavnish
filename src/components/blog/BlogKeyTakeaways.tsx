/** Optional quick-scan summary, sourced from posts.meta.keyTakeaways (string[]). Blog stays off
 * the block system entirely (spec §12) — this is a plain meta field, not a content_blocks row. */
export function BlogKeyTakeaways({ items }: { items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="bg-[#FAF8F5] border border-[var(--divider)] rounded-bento p-6 mb-8">
      <h2 className="font-heading text-lg font-bold text-charcoal mb-3">Key takeaways</h2>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2.5 text-secondary text-[1rem] leading-relaxed">
            <span className="text-primary font-bold shrink-0">✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
