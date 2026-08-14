"use client";

import { useEffect, useState } from "react";
import { ReadingSandbox, type GlossaryEntry } from "@/components/learn/ReadingSandbox";

type Reading = { slug: string; title: string };

export function ReadingSandboxClient() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [glossary, setGlossary] = useState<GlossaryEntry[]>([]);
  const [title, setTitle] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);

  useEffect(() => {
    fetch("/api/learn/reading")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data.readings) ? data.readings : [];
        setReadings(list);
        if (list[0]) setSelectedSlug(list[0].slug);
      })
      .catch(() => setReadings([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedSlug) {
      setContent("");
      setGlossary([]);
      setTitle("");
      return;
    }
    setContentLoading(true);
    fetch(`/api/learn/reading/${encodeURIComponent(selectedSlug)}`)
      .then((r) => r.json())
      .then((data) => {
        setTitle(data.post?.title ?? "");
        setContent(data.post?.content ?? "");
        setGlossary(Array.isArray(data.glossary) ? data.glossary : []);
      })
      .catch(() => {
        setContent("");
        setGlossary([]);
        setTitle("");
      })
      .finally(() => setContentLoading(false));
  }, [selectedSlug]);

  if (loading) return <p className="text-secondary text-sm">Loading…</p>;

  if (readings.length === 0) {
    return (
      <div className="rounded-bento border border-[var(--divider)] bg-white p-6 text-center text-secondary">
        <p>No reading content yet. Add reading posts and glossary entries in admin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-secondary mb-2">Choose a text:</p>
        <div className="flex flex-wrap gap-2">
          {readings.map((r) => (
            <button
              key={r.slug}
              type="button"
              onClick={() => setSelectedSlug(r.slug)}
              className={`px-3 py-1.5 rounded-bento text-sm ${selectedSlug === r.slug ? "bg-primary text-white" : "border border-[var(--divider)] hover:bg-[var(--divider)]/20"}`}
            >
              {r.title || r.slug}
            </button>
          ))}
        </div>
      </div>
      {contentLoading ? (
        <p className="text-secondary text-sm">Loading…</p>
      ) : (
        <>
          {title && <h2 className="font-heading text-xl font-semibold text-charcoal">{title}</h2>}
          <ReadingSandbox content={content} glossary={glossary} />
        </>
      )}
    </div>
  );
}
