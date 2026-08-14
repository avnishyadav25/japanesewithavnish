"use client";

import { useState } from "react";
import { ShadowingCard } from "@/components/learn/ShadowingCard";

type Item = { id: string; title: string | null; audio_url: string | null; slug: string };

export function ShadowingPageClient({ initialItems }: { initialItems: Item[] }) {
  const [selected, setSelected] = useState<Item | null>(initialItems[0] ?? null);
  const [customUrl, setCustomUrl] = useState("");

  if (initialItems.length === 0 && !customUrl) {
    return (
      <div className="rounded-bento border border-[var(--divider)] bg-white p-6 text-center text-secondary">
        <p>No listening content with audio is available yet. Add audio URLs to listening posts in admin, or paste a direct audio URL below.</p>
        <div className="mt-4 max-w-md mx-auto">
          <input
            type="url"
            placeholder="https://… audio URL"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-sm"
          />
          {customUrl.trim() && (
            <div className="mt-3">
              <ShadowingCard audioUrl={customUrl.trim()} title="Custom audio" />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {initialItems.length > 0 && (
        <div>
          <p className="text-sm text-secondary mb-2">Choose a clip:</p>
          <ul className="flex flex-wrap gap-2">
            {initialItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelected(item)}
                  className={`px-3 py-1.5 rounded-bento text-sm ${selected?.id === item.id ? "bg-primary text-white" : "border border-[var(--divider)] hover:bg-[var(--divider)]/20"}`}
                >
                  {item.title || item.slug || "Audio"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {selected?.audio_url && (
        <ShadowingCard
          audioUrl={selected.audio_url}
          title={selected.title ?? undefined}
        />
      )}
      <div className="pt-4 border-t border-[var(--divider)]">
        <p className="text-sm text-secondary mb-2">Or paste a direct audio URL:</p>
        <input
          type="url"
          placeholder="https://…"
          value={customUrl}
          onChange={(e) => setCustomUrl(e.target.value)}
          className="w-full max-w-md px-3 py-2 border border-[var(--divider)] rounded-bento text-sm"
        />
        {customUrl.trim() && (
          <div className="mt-3">
            <ShadowingCard audioUrl={customUrl.trim()} title="Custom audio" />
          </div>
        )}
      </div>
    </div>
  );
}
