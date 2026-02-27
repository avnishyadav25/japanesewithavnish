"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useEffect } from "react";

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
  const level = searchParams.get("level") || "all";
  const type = searchParams.get("type") || "all";
  const search = searchParams.get("search") || "";

  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    setSearchInput(searchParams.get("search") || "");
  }, [searchParams]);

  const updateParams = useCallback(
    (updates: { level?: string; type?: string; search?: string; page?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (updates.level !== undefined) params.set("level", updates.level);
      if (updates.type !== undefined) params.set("type", updates.type);
      if (updates.search !== undefined) {
        if (updates.search) params.set("search", updates.search);
        else params.delete("search");
      }
      if (updates.page !== undefined) params.set("page", updates.page);
      else params.delete("page");
      router.push(`/blog?${params.toString()}`);
    },
    [router, searchParams]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({ search: searchInput.trim() || undefined, page: "1" });
  };

  return (
    <div className="mb-8">
      <form onSubmit={handleSearch} className="mb-4">
        <div className="flex gap-2">
          <input
            type="search"
            placeholder="Search grammar, kanji, vocab, roadmap…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="flex-1 px-4 py-2.5 border border-[var(--divider)] rounded-md text-charcoal placeholder:text-secondary"
          />
          <button type="submit" className="btn-primary px-5">
            Search
          </button>
        </div>
      </form>
      <div className="flex flex-col gap-3">
        <div>
          <span className="text-xs text-secondary font-medium uppercase tracking-wider block mb-2">
            JLPT Level
          </span>
          <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
            {LEVEL_PILLS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => updateParams({ level: p.id, page: "1" })}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
                  level === p.id
                    ? "bg-primary text-white"
                    : "bg-base border border-[var(--divider)] text-secondary hover:border-primary hover:text-primary"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="text-xs text-secondary font-medium uppercase tracking-wider block mb-2">
            Topic
          </span>
          <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
            {TOPIC_PILLS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => updateParams({ type: p.id, page: "1" })}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
                  type === p.id
                    ? "bg-primary text-white"
                    : "bg-base border border-[var(--divider)] text-secondary hover:border-primary hover:text-primary"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
