"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type NextLesson = { id: string; code: string; title: string };

export function LessonCompleteButton({
  lessonId,
  nextLesson = null,
}: {
  lessonId: string;
  nextLesson?: NextLesson | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleComplete() {
    setLoading(true);
    try {
      const res = await fetch("/api/learn/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId }),
      });
      if (res.ok) setDone(true);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <p className="text-charcoal font-medium">Lesson marked complete.</p>
        <div className="flex flex-wrap gap-3 items-center">
          {nextLesson ? (
            <Link
              href={`/learn/curriculum/lesson/${nextLesson.id}`}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-bento bg-primary text-white font-semibold hover:opacity-90 transition"
            >
              Next lesson →
            </Link>
          ) : null}
          <Link
            href="/learn/curriculum"
            className="inline-flex items-center px-4 py-3 rounded-bento border border-[var(--divider)] text-charcoal font-medium hover:bg-[var(--divider)]/20 transition"
          >
            Back to path
          </Link>
          <Link href="/learn/dashboard" className="text-primary text-sm font-medium hover:underline">
            Dashboard
          </Link>
        </div>
        {nextLesson && (
          <p className="text-secondary text-sm">
            Next: {nextLesson.code} — {nextLesson.title}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleComplete}
        disabled={loading}
        className="btn-primary px-6 py-3 text-base font-semibold"
      >
        {loading ? "Saving…" : "Mark complete"}
      </button>
    </div>
  );
}
