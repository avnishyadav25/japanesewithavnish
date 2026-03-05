"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const LEVEL_PILLS = [
  { id: "all", label: "All" },
  { id: "n5", label: "N5" },
  { id: "n4", label: "N4" },
  { id: "n3", label: "N3" },
  { id: "n2", label: "N2" },
  { id: "n1", label: "N1" },
  { id: "mega", label: "Mega" },
];

const TOPIC_PILLS = [
  { id: "all", label: "All" },
  { id: "grammar", label: "Grammar" },
  { id: "vocabulary", label: "Vocabulary" },
  { id: "kanji", label: "Kanji" },
  { id: "reading", label: "Reading" },
  { id: "listening", label: "Listening" },
  { id: "roadmap", label: "Roadmap" },
  { id: "tips", label: "Tips" },
];

export function BlogFilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const level = searchParams?.get("level") || "all";
  const type = searchParams?.get("type") || "all";

  const updateParams = useCallback(
    (updates: { level?: string; type?: string; page?: string }) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (updates.level !== undefined) params.set("level", updates.level);
      if (updates.type !== undefined) params.set("type", updates.type);
      if (updates.page !== undefined) params.set("page", updates.page);
      else params.delete("page");
      router.push(`/blog?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {LEVEL_PILLS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => updateParams({ level: p.id, page: "1" })}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
            level === p.id
              ? "bg-primary text-white"
              : "bg-[#FAF8F5] border border-[#EEEEEE] text-[#555555] hover:border-primary hover:text-primary"
          }`}
        >
          {p.label}
        </button>
      ))}
      {TOPIC_PILLS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => updateParams({ type: p.id, page: "1" })}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
            type === p.id
              ? "bg-primary text-white"
              : "bg-[#FAF8F5] border border-[#EEEEEE] text-[#555555] hover:border-primary hover:text-primary"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
