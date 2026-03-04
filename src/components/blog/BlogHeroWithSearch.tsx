"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback, useEffect } from "react";

export function BlogHeroWithSearch({ initialSearch = "" }: { initialSearch?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchFromUrl = searchParams.get("search") ?? "";
  const [searchInput, setSearchInput] = useState(initialSearch || searchFromUrl);

  useEffect(() => {
    setSearchInput(searchParams.get("search") ?? "");
  }, [searchParams]);

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const params = new URLSearchParams(searchParams.toString());
      const q = searchInput.trim();
      if (q) params.set("search", q);
      else params.delete("search");
      params.delete("page");
      router.push(`/blog?${params.toString()}`);
    },
    [router, searchParams, searchInput]
  );

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto md:min-w-[280px]">
      <form onSubmit={handleSearch} className="flex gap-2 flex-1 sm:flex-initial">
        <input
          type="search"
          placeholder="Search grammar, kanji, vocab, roadmap…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="flex-1 min-w-0 px-4 py-2.5 border border-[#EEEEEE] rounded-md text-charcoal placeholder:text-[#555555] bg-white text-sm"
        />
        <button type="submit" className="btn-primary px-4 shrink-0">
          Search
        </button>
      </form>
      <div className="flex gap-4 text-sm">
        <Link href="/quiz" className="text-primary font-medium hover:underline">
          Take the Quiz →
        </Link>
        <Link href="/store" className="text-primary font-medium hover:underline">
          Browse Bundles →
        </Link>
      </div>
    </div>
  );
}
