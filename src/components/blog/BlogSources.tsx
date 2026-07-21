/** Optional references list, sourced from posts.meta.sources ({title,url}[]). */
export function BlogSources({ sources }: { sources: { title: string; url: string }[] }) {
  if (!sources || sources.length === 0) return null;
  return (
    <div className="mt-8 pt-6 border-t border-[var(--divider)]">
      <h2 className="font-heading text-sm font-bold text-charcoal mb-3">Sources</h2>
      <ol className="space-y-1.5 list-decimal list-inside">
        {sources.map((s, i) => (
          <li key={i} className="text-secondary text-sm">
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {s.title}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
