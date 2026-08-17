"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The confirm step between "what the filters found" and "what goes in the video".
 *
 * Replaces a read-only <ul> that showed the first 25 auto-picked items with no way to change
 * them. Serves both scopes: a content batch arrives pre-ticked with what the query chose (so
 * doing nothing behaves exactly as before), and a topic arrives with library matches plus
 * LLM-written suggestions that are visibly marked as unreviewed.
 *
 * Every row links to its live page. That is the whole point of the confirm step — a topic search
 * for "birds" genuinely returns 巻き込む ("to swallow up") and you can only tell by looking.
 */
export interface PickerItem {
  postId?: string;
  contentType: string;
  title: string;
  word?: string;
  reading?: string;
  meaning?: string;
  jlptLevel?: string;
  url?: string;
  source: "library" | "llm";
  matchedTerm?: string;
  /** The full proposal, carried so the commit step needs no second model call. */
  proposal?: Record<string, unknown>;
}

const LEVEL_TONE: Record<string, string> = {
  N5: "bg-emerald-50 text-emerald-700",
  N4: "bg-sky-50 text-sky-700",
  N3: "bg-amber-50 text-amber-700",
  N2: "bg-orange-50 text-orange-700",
  N1: "bg-red-light text-primary",
};

export function ItemPicker({
  items,
  selectedIds,
  onChange,
  onAdd,
  onRemoveProposed,
  contentType,
  jlptLevel,
  busy,
}: {
  items: PickerItem[];
  /** Keyed by postId for library items and by `llm:<word>` for proposals. */
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onAdd?: (item: PickerItem) => void;
  onRemoveProposed?: (key: string) => void;
  contentType?: string;
  jlptLevel?: string;
  busy?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickerItem[]>([]);
  const [searching, setSearching] = useState(false);
  const searchSeq = useRef(0);

  const keyOf = useCallback(
    (i: PickerItem) => i.postId ?? `llm:${i.word ?? i.title}`,
    []
  );

  // Debounced, and sequence-guarded: without the counter a slow early request can land after a
  // fast later one and repopulate the list with results for a query you already changed.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      return;
    }
    const seq = ++searchSeq.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q, limit: "15" });
        if (contentType) params.set("contentType", contentType);
        if (jlptLevel) params.set("jlptLevel", jlptLevel);
        const res = await fetch(`/api/admin/video/content/search?${params}`);
        const data = await res.json();
        if (seq === searchSeq.current) setResults(data.items ?? []);
      } catch {
        if (seq === searchSeq.current) setResults([]);
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, contentType, jlptLevel]);

  function toggle(key: string) {
    onChange(selectedIds.includes(key) ? selectedIds.filter((k) => k !== key) : [...selectedIds, key]);
  }

  const chosen = items.filter((i) => selectedIds.includes(keyOf(i)));
  const llmCount = chosen.filter((i) => i.source === "llm").length;

  return (
    <div className="border border-[var(--divider)] rounded-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-3 py-2 bg-base border-b border-[var(--divider)]">
        <div className="text-xs text-secondary">
          <span className="font-semibold text-charcoal">{chosen.length}</span> of {items.length} selected
          {llmCount > 0 && <span className="text-amber-700"> · {llmCount} newly written</span>}
        </div>
        <div className="flex gap-3 text-xs">
          <button type="button" onClick={() => onChange(items.map(keyOf))} className="text-primary hover:underline">
            All
          </button>
          <button type="button" onClick={() => onChange([])} className="text-secondary hover:underline">
            None
          </button>
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto divide-y divide-[var(--divider)]">
        {items.length === 0 && <p className="px-3 py-4 text-sm text-secondary">Nothing selected yet.</p>}
        {items.map((item) => {
          const key = keyOf(item);
          const on = selectedIds.includes(key);
          return (
            <div key={key} className={`flex items-center gap-3 px-3 py-2 text-sm ${on ? "" : "opacity-50"}`}>
              <input type="checkbox" checked={on} onChange={() => toggle(key)} disabled={busy} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-charcoal font-medium truncate">{item.word || item.title}</span>
                  {item.reading && <span className="text-xs text-secondary truncate">{item.reading}</span>}
                  {item.jlptLevel && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-badge ${LEVEL_TONE[item.jlptLevel] ?? "bg-base text-secondary"}`}>
                      {item.jlptLevel}
                    </span>
                  )}
                  {item.source === "llm" && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-badge bg-amber-50 text-amber-700"
                      title="Written just now by the model. Nobody has checked the reading — it becomes a draft post for review."
                    >
                      unreviewed
                    </span>
                  )}
                </div>
                {item.meaning && <div className="text-xs text-secondary truncate">{item.meaning}</div>}
              </div>
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline shrink-0"
                >
                  view
                </a>
              ) : (
                onRemoveProposed && (
                  <button
                    type="button"
                    onClick={() => onRemoveProposed(key)}
                    className="text-xs text-secondary hover:text-primary shrink-0"
                    title="Discard this suggestion"
                  >
                    remove
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>

      {onAdd && (
        <div className="border-t border-[var(--divider)] p-3 space-y-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Add an item — search by Japanese, romaji or meaning"
            className="w-full border border-[var(--divider)] rounded-button px-3 py-2 text-sm focus:outline-none focus:border-primary"
          />
          {searching && <p className="text-xs text-secondary">Searching…</p>}
          {results.length > 0 && (
            <div className="max-h-44 overflow-y-auto border border-[var(--divider)] rounded-button divide-y divide-[var(--divider)]">
              {results.map((r) => {
                const already = items.some((i) => i.postId && i.postId === r.postId);
                return (
                  <button
                    key={r.postId}
                    type="button"
                    disabled={already}
                    onClick={() => {
                      onAdd(r);
                      setQuery("");
                      setResults([]);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-base disabled:opacity-40 flex items-center gap-2"
                  >
                    <span className="text-charcoal font-medium">{r.word || r.title}</span>
                    <span className="text-xs text-secondary truncate flex-1">{r.meaning}</span>
                    <span className="text-[10px] text-secondary shrink-0">{r.jlptLevel ?? ""}</span>
                    {already && <span className="text-[10px] text-secondary shrink-0">added</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
