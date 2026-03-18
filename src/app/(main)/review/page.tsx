"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type ReviewItem = {
  id: string;
  itemType: string;
  itemId: string;
  title: string;
  slug: string;
  contentType: string | null;
  content: string;
  meta: unknown;
};

export default function ReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/review")
      .then((res) => res.json())
      .then((data) => {
        if (data.error && data.items === undefined) {
          setError(data.error);
          setItems([]);
        } else {
          setItems(Array.isArray(data.items) ? data.items : []);
        }
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  async function submit(correct: boolean) {
    const item = items[index];
    if (!item || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId: item.id, correct }),
      });
      if (!res.ok) throw new Error("Failed");
      setItems((prev) => prev.filter((_, i) => i !== index));
      setIndex(0);
      setFlipped(false);
    } catch {
      setError("Could not save. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--base)] flex items-center justify-center">
        <p className="text-secondary">Loading your reviews…</p>
      </div>
    );
  }

  if (error === "Unauthorized" || (error && items.length === 0)) {
    return (
      <div className="min-h-screen bg-[var(--base)] flex flex-col items-center justify-center px-4">
        <h1 className="font-heading text-2xl font-bold text-charcoal mb-2">Review</h1>
        <p className="text-secondary text-center mb-6">
          Sign in to see your scheduled reviews and track progress.
        </p>
        <Link href="/login?redirect=/review" className="btn-primary">
          Log in
        </Link>
        <Link href="/learn" className="mt-4 text-primary text-sm hover:underline">
          Browse Learn hub →
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[var(--base)] flex flex-col items-center justify-center px-4">
        <h1 className="font-heading text-2xl font-bold text-charcoal mb-2">No reviews due</h1>
        <p className="text-secondary text-center mb-6">
          When you add items from Nihongo Navi or mark lessons for review, they’ll show up here.
        </p>
        <Link href="/tutor" className="btn-primary">
          Open Nihongo Navi
        </Link>
        <Link href="/learn" className="mt-4 text-primary text-sm hover:underline">
          Learn hub →
        </Link>
      </div>
    );
  }

  const item = items[index];
  if (!item) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--base)] flex flex-col">
      <header className="border-b border-[var(--divider)] bg-white px-4 py-3 flex items-center justify-between">
        <h1 className="font-heading font-bold text-charcoal">Review</h1>
        <span className="text-secondary text-sm">
          {index + 1} of {items.length}
        </span>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-lg mx-auto w-full">
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          className="w-full min-h-[200px] rounded-bento border-2 border-[var(--divider)] bg-white p-6 text-left hover:border-primary transition-colors"
        >
          {!flipped ? (
            <div>
              <span className="text-xs font-semibold text-primary uppercase">{item.itemType}</span>
              <p className="font-heading text-xl font-bold text-charcoal mt-2">{item.title}</p>
              <p className="text-secondary text-sm mt-2">Tap to reveal</p>
            </div>
          ) : (
            <div className="prose prose-sm max-w-none">
              <p className="text-charcoal whitespace-pre-wrap">{item.content || "No content."}</p>
              {item.slug && (
                <Link
                  href={`/blog/${item.contentType ?? "vocabulary"}/${item.slug}`}
                  className="text-primary text-sm mt-2 inline-block hover:underline"
                >
                  Open lesson →
                </Link>
              )}
            </div>
          )}
        </button>

        {flipped && (
          <div className="flex gap-3 mt-6 w-full">
            <button
              type="button"
              onClick={() => submit(false)}
              disabled={submitting}
              className="flex-1 py-3 rounded-bento border-2 border-[var(--divider)] text-charcoal hover:border-primary transition"
            >
              Incorrect
            </button>
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={submitting}
              className="flex-1 py-3 rounded-bento btn-primary"
            >
              Correct
            </button>
          </div>
        )}
        {error && <p className="text-primary text-sm mt-4">{error}</p>}
      </div>
    </div>
  );
}
