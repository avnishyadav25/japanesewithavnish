"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useEffect } from "react";
import { LEARN_CATEGORIES } from "@/lib/learn-filters";

const SORT_OPTIONS = [
  { id: "newest", label: "Newest" },
  { id: "recommended", label: "Recommended" },
];

interface LearnFilterBarProps {
  lockCategory?: string;
  basePath?: string;
}

export function LearnFilterBar({ lockCategory, basePath = "/learn" }: LearnFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const category = lockCategory ?? searchParams.get("category") ?? "all";
  const search = searchParams.get("search") ?? "";
  const sort = searchParams.get("sort") ?? "newest";

  const [searchInput, setSearchInput] = useState(search);

  useEffect(() => {
    setSearchInput(searchParams.get("search") ?? "");
  }, [searchParams]);

  const updateParams = useCallback(
    (updates: { level?: string; category?: string; search?: string; sort?: string; page?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (updates.level !== undefined) {
        if (updates.level === "all") params.delete("level");
        else params.set("level", updates.level);
      }
      if (updates.category !== undefined && !lockCategory) {
        if (updates.category === "all") params.delete("category");
        else params.set("category", updates.category);
      }
      if (updates.search !== undefined) {
        if (updates.search) params.set("search", updates.search);
        else params.delete("search");
      }
      if (updates.sort !== undefined) params.set("sort", updates.sort);
      if (updates.page !== undefined) params.set("page", updates.page);
      else params.delete("page");
      router.push(`${basePath}?${params.toString()}`);
    },
    [router, searchParams, lockCategory, basePath]
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
            placeholder="Search grammar, kanji, vocab…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="flex-1 px-4 py-2.5 border border-[#EEEEEE] rounded-md text-charcoal placeholder:text-[#555555] bg-white"
          />
          <button type="submit" className="btn-primary px-5">
            Search
          </button>
        </div>
      </form>
      <div className="flex flex-col gap-3">
        {!lockCategory && (
          <div>
            <span className="text-xs text-[#555555] font-medium uppercase tracking-wider block mb-2">
              Category
            </span>
            <div className="flex flex-wrap gap-2">
              {LEARN_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => updateParams({ category: c.id, page: "1" })}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                    category === c.id
                      ? "bg-primary text-white"
                      : "bg-[#FAF8F5] border border-[#EEEEEE] text-[#555555] hover:border-primary"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div>
          <span className="text-xs text-[#555555] font-medium uppercase tracking-wider block mb-2">
            Sort
          </span>
          <div className="flex flex-wrap gap-2">
            {SORT_OPTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => updateParams({ sort: s.id, page: "1" })}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  sort === s.id
                    ? "bg-primary text-white"
                    : "bg-[#FAF8F5] border border-[#EEEEEE] text-[#555555] hover:border-primary"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
