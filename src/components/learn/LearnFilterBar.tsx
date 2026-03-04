"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const SORT_OPTIONS = [
  { id: "newest", label: "Newest" },
  { id: "recommended", label: "Recommended" },
];

interface LearnFilterBarProps {
  lockCategory?: string;
  basePath?: string;
}

export function LearnFilterBar({ basePath = "/learn" }: LearnFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sort = searchParams.get("sort") ?? "newest";

  const updateParams = useCallback(
    (updates: { sort?: string; page?: string }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (updates.sort !== undefined) params.set("sort", updates.sort);
      if (updates.page !== undefined) params.set("page", updates.page);
      else params.delete("page");
      router.push(`${basePath}?${params.toString()}`);
    },
    [router, searchParams, basePath]
  );

  return (
    <div className="mb-8">
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
  );
}
