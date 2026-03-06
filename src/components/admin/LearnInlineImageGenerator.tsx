"use client";

import { useMemo, useState } from "react";

export type LearnImagePromptItem = {
  placeholder: string;
  role: string;
  prompt: string;
  aspect_ratio?: string;
};

type LearnInlineImageGeneratorProps = {
  items: LearnImagePromptItem[];
  content: string;
  generated: Record<string, string>;
  onContentUpdate: (content: string) => void;
  onItemsUpdate: (items: LearnImagePromptItem[]) => void;
  onGeneratedUpdate: (generated: Record<string, string>) => void;
  onAutoSave?: (next: {
    content: string;
    items: LearnImagePromptItem[];
    generated: Record<string, string>;
  }) => Promise<void>;
};

export function LearnInlineImageGenerator({
  items,
  content,
  generated,
  onContentUpdate,
  onItemsUpdate,
  onGeneratedUpdate,
  onAutoSave,
}: LearnInlineImageGeneratorProps) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [autoSavedAt, setAutoSavedAt] = useState<number | null>(null);

  const normalizedItems = useMemo(
    () =>
      (Array.isArray(items) ? items : []).filter(
        (x) =>
          x &&
          typeof x.placeholder === "string" &&
          typeof x.role === "string" &&
          typeof x.prompt === "string"
      ),
    [items]
  );

  /** Apply one generated image into current content + generated map; returns new content and map. */
  function applyOne(
    item: LearnImagePromptItem,
    newUrl: string,
    currentContent: string,
    currentGenerated: Record<string, string>
  ): { content: string; generated: Record<string, string> } {
    const markdown = `![${item.role}](${newUrl})`;
    let nextContent = currentContent;
    const existingUrl = currentGenerated[item.placeholder];

    if (existingUrl && nextContent.includes(existingUrl)) {
      nextContent = nextContent.replace(existingUrl, newUrl);
    } else if (nextContent.includes(item.placeholder)) {
      nextContent = nextContent.replace(item.placeholder, markdown);
    } else {
      nextContent = `${nextContent}\n\n${markdown}\n`;
    }
    const nextGenerated = { ...currentGenerated, [item.placeholder]: newUrl };
    return { content: nextContent, generated: nextGenerated };
  }

  async function generateOne(item: LearnImagePromptItem) {
    setGenerating(item.placeholder);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageType: "learning",
          prompt: item.prompt,
          aspectRatio: item.aspect_ratio || "1:1",
          context: {},
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Image generation failed");
        return;
      }
      if (!data.imageUrl) {
        setError(data.error || "No image returned");
        return;
      }

      const newUrl = String(data.imageUrl);
      const { content: nextContent, generated: nextGenerated } = applyOne(item, newUrl, content, generated);
      onGeneratedUpdate(nextGenerated);
      onContentUpdate(nextContent);
      if (onAutoSave) {
        setAutoSaving(true);
        try {
          await onAutoSave({
            content: nextContent,
            items: normalizedItems,
            generated: nextGenerated,
          });
          setAutoSavedAt(Date.now());
        } catch (e) {
          setError(e instanceof Error ? e.message : "Auto-save failed");
        } finally {
          setAutoSaving(false);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setGenerating(null);
    }
  }

  async function generateAll() {
    if (bulkRunning) return;
    setBulkRunning(true);
    setError(null);
    let accContent = content;
    let accGenerated = { ...generated };
    try {
      for (const item of normalizedItems) {
        if (accGenerated[item.placeholder]) continue;
        setGenerating(item.placeholder);
        try {
          const res = await fetch("/api/ai/generate-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageType: "learning",
              prompt: item.prompt,
              aspectRatio: item.aspect_ratio || "1:1",
              context: {},
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            setError(data.error || "Image generation failed");
            break;
          }
          if (!data.imageUrl) {
            setError(data.error || "No image returned");
            break;
          }
          const newUrl = String(data.imageUrl);
          const next = applyOne(item, newUrl, accContent, accGenerated);
          accContent = next.content;
          accGenerated = next.generated;
          onContentUpdate(accContent);
          onGeneratedUpdate(accGenerated);
          if (onAutoSave) {
            setAutoSaving(true);
            try {
              await onAutoSave({
                content: accContent,
                items: normalizedItems,
                generated: accGenerated,
              });
              setAutoSavedAt(Date.now());
            } catch (e) {
              setError(e instanceof Error ? e.message : "Auto-save failed");
              break;
            } finally {
              setAutoSaving(false);
            }
          }
        } finally {
          setGenerating(null);
        }
      }
    } finally {
      setBulkRunning(false);
    }
  }

  if (normalizedItems.length === 0) return null;

  return (
    <div className="mt-4 p-4 border border-[var(--divider)] rounded-bento bg-[var(--base)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-charcoal">Inline images (AI)</h3>
          <p className="text-xs text-secondary mt-1">
            Generate images from prompts and auto-insert them into the lesson content (Markdown).
          </p>
          {onAutoSave && (
            <p className="text-[11px] text-secondary mt-1">
              {autoSaving
                ? "Saving…"
                : autoSavedAt
                  ? `Saved ${new Date(autoSavedAt).toLocaleTimeString()}`
                  : "Auto-save enabled"}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={generateAll}
          disabled={bulkRunning || generating !== null}
          className="btn-secondary text-sm"
        >
          {bulkRunning ? "Generating…" : "Generate all (missing)"}
        </button>
      </div>

      {error && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {normalizedItems.map((item, idx) => {
          const url = generated[item.placeholder];
          return (
            <div
              key={item.placeholder}
              className="p-3 bg-white rounded-bento border border-[var(--divider)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-charcoal">{item.role}</p>
                  <p className="text-xs text-secondary mt-1">
                    Placeholder:{" "}
                    <code className="bg-[var(--divider)]/40 px-1 rounded">
                      {item.placeholder}
                    </code>
                  </p>
                  <textarea
                    value={item.prompt}
                    onChange={(e) => {
                      const next = [...normalizedItems];
                      next[idx] = { ...next[idx], prompt: e.target.value };
                      onItemsUpdate(next);
                    }}
                    rows={3}
                    className="mt-2 w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-charcoal text-sm"
                  />
                  <div className="mt-1 text-[11px] text-secondary">
                    Aspect ratio:{" "}
                    <code className="bg-[var(--divider)]/40 px-1 rounded">
                      {item.aspect_ratio || "1:1"}
                    </code>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => generateOne(item)}
                  disabled={generating !== null}
                  className="text-sm text-primary hover:underline shrink-0 disabled:opacity-50"
                >
                  {generating === item.placeholder
                    ? "Generating…"
                    : url
                      ? "Regenerate"
                      : "Generate"}
                </button>
              </div>

              {url && (
                <div className="mt-3 rounded overflow-hidden max-w-xs border border-[var(--divider)]">
                  <img src={url} alt="" className="w-full aspect-square object-cover" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

