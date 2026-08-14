"use client";

import { useState } from "react";

export type SectionImagePrompt = {
  placeholder: string;
  section: string;
  prompt: string;
};

type SectionImageGeneratorProps = {
  items: SectionImagePrompt[];
  content: string;
  onContentUpdate: (content: string) => void;
};

export function SectionImageGenerator({
  items,
  content,
  onContentUpdate,
}: SectionImageGeneratorProps) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [generated, setGenerated] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(item: SectionImagePrompt) {
    setGenerating(item.placeholder);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageType: "blog",
          prompt: item.prompt,
          context: {},
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Image generation failed");
        return;
      }
      if (data.imageUrl) {
        const existingUrl = generated[item.placeholder];
        const markdown = `![${item.section}](${data.imageUrl})`;
        let newContent: string;
        if (existingUrl) {
          newContent = content.replace(existingUrl, data.imageUrl);
        } else {
          newContent = content.replace(item.placeholder, markdown);
        }
        setGenerated((g) => ({ ...g, [item.placeholder]: data.imageUrl }));
        onContentUpdate(newContent);
      } else {
        setError(data.error || "No image returned");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setGenerating(null);
    }
  }

  if (items.length === 0) return null;

  return (
    <div className="mt-4 p-4 border border-[var(--divider)] rounded-bento bg-[var(--base)]">
      <h3 className="text-sm font-semibold text-charcoal mb-3">Section images</h3>
      <p className="text-xs text-secondary mb-3">
        Generate diagrams for each section. Images will be inserted into the content.
      </p>
      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.placeholder}
            className="p-3 bg-white rounded-bento border border-[var(--divider)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-charcoal">{item.section}</p>
                <p className="text-xs text-secondary mt-1 line-clamp-2">{item.prompt}</p>
              </div>
              <button
                type="button"
                onClick={() => handleGenerate(item)}
                disabled={generating !== null}
                className="text-sm text-primary hover:underline shrink-0 disabled:opacity-50"
              >
                {generating === item.placeholder
                  ? "Generating…"
                  : generated[item.placeholder]
                    ? "Regenerate"
                    : "Generate"}
              </button>
            </div>
            {generated[item.placeholder] && (
              <div className="mt-2 rounded overflow-hidden max-w-xs">
                <img
                  src={generated[item.placeholder]}
                  alt=""
                  className="w-full aspect-video object-cover object-top"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
