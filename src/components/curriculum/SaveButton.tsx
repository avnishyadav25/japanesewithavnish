"use client";

import { useState } from "react";

export function SaveButton({
  ownerType,
  ownerId,
  saved: initiallySaved,
}: {
  ownerType: "lesson" | "post";
  ownerId: string;
  saved: boolean;
}) {
  const [saved, setSaved] = useState(initiallySaved);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const nextSaved = !saved;
    try {
      await fetch("/api/learn/saved-items", {
        method: nextSaved ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerType, ownerId }),
      });
      setSaved(nextSaved);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={toggle}
      aria-pressed={saved}
      className={`flex items-center gap-1.5 text-xs font-semibold rounded-xl px-3 py-1.5 border transition disabled:opacity-60 ${
        saved
          ? "border-primary/30 bg-primary/5 text-primary"
          : "border-[var(--divider)] text-secondary hover:border-primary/40 hover:text-primary"
      }`}
    >
      <span>{saved ? "★" : "☆"}</span>
      <span>{saved ? "Saved" : "Save"}</span>
    </button>
  );
}
