"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LearnLevelTabs } from "./LearnLevelTabs";
import { LearnCategoryGrid } from "./LearnCategoryGrid";
import { LearnFilterBar } from "./LearnFilterBar";
import { LearnLessonCard } from "./LearnLessonCard";
import { LearnBundleCta } from "./LearnBundleCta";
import type { LearnLevel } from "@/lib/learn-filters";
import type { LearnItemForFilter } from "@/lib/learn-filters";

const PER_PAGE = 12;

interface LearnContentProps {
  level: LearnLevel;
  category: string;
  sort: string;
  recommended: LearnItemForFilter[];
  items: LearnItemForFilter[];
  totalCount: number;
  currentPage: number;
  basePath?: string;
  lockCategory?: string;
  heroTitle?: string;
  heroSubtext?: string;
}

export function LearnContent({
  level,
  category,
  sort,
  recommended,
  items,
  totalCount,
  currentPage,
  basePath = "/learn",
  lockCategory,
  heroTitle = "Learn",
  heroSubtext = "Grammar, vocabulary, kanji, reading, and writing — structured by JLPT level.",
}: LearnContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchFromUrl = searchParams?.get("search") ?? "";
  const [searchInput, setSearchInput] = useState(searchFromUrl);
  useEffect(() => {
    setSearchInput(searchFromUrl);
  }, [searchFromUrl]);

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      const q = searchInput.trim();
      if (q) params.set("search", q);
      else params.delete("search");
      params.delete("page");
      router.push(`${basePath}?${params.toString()}`);
    },
    [basePath, router, searchParams, searchInput]
  );

  const totalPages = Math.ceil(totalCount / PER_PAGE) || 1;
  const hasMore = currentPage < totalPages;
  const hasPrev = currentPage > 1;

  const nextParams = new URLSearchParams();
  if (level !== "all") nextParams.set("level", level);
  if (category !== "all" && !lockCategory) nextParams.set("category", category);
  if (sort !== "newest") nextParams.set("sort", sort);
  nextParams.set("page", String(currentPage + 1));
  const nextHref = `${basePath}?${nextParams.toString()}`;

  const prevParams = new URLSearchParams();
  if (level !== "all") prevParams.set("level", level);
  if (category !== "all" && !lockCategory) prevParams.set("category", category);
  if (sort !== "newest") prevParams.set("sort", sort);
  if (currentPage > 2) prevParams.set("page", String(currentPage - 1));
  const prevHref = currentPage <= 2 ? (prevParams.toString() ? `${basePath}?${prevParams.toString()}` : basePath) : `${basePath}?${prevParams.toString()}`;

  return (
    <div className="py-12 sm:py-16 px-4 sm:px-6">
      <div className="max-w-[1100px] mx-auto">
        {/* Hero: title left, search + links top right */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-8">
          <div>
            <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal mb-2">
              {heroTitle}
            </h1>
            <p className="text-secondary">
              {heroSubtext}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto md:min-w-[280px]">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1 sm:flex-initial">
              <input
                type="search"
                placeholder="Search grammar, kanji, vocab…"
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
              <Link href="/jlpt" className="text-primary font-medium hover:underline">
                Explore JLPT Levels →
              </Link>
            </div>
          </div>
        </div>

        {/* Level + category on same card (N5/N4/… and Grammar/Vocab/… pills) */}
        <div className="card p-5 mb-8">
          <div className="flex flex-wrap gap-4 items-start">
            <LearnLevelTabs active={level} basePath={basePath} showHelpText={false} />
            <div className="flex flex-wrap gap-2 items-center">
              <LearnCategoryGrid level={level} activeCategory={lockCategory ?? undefined} />
            </div>
          </div>
          <p className="text-[#555555] text-sm mt-3">
            Not sure your level?{" "}
            <a href="/quiz" className="text-primary font-medium hover:underline">
              Take the quiz →
            </a>
          </p>
        </div>

        {/* Recommended lessons */}
        {recommended.length > 0 && (
          <div className="mb-10">
            <h2 className="font-heading text-xl font-bold text-charcoal mb-4">Recommended lessons</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recommended.slice(0, 6).map((item) => (
                <LearnLessonCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}

        {/* Search + filter bar */}
        <LearnFilterBar lockCategory={lockCategory} basePath={basePath} />

        {/* Latest lessons grid */}
        <div className="mb-10">
          <h2 className="font-heading text-xl font-bold text-charcoal mb-4">
            {lockCategory ? `${lockCategory.charAt(0).toUpperCase() + lockCategory.slice(1)} lessons` : "Latest lessons"}
          </h2>
          {items.length > 0 ? (
            <>
              {!lockCategory && level === "all" ? (
                <div className="card p-0 overflow-hidden divide-y-0">
                  {items.map((item) => (
                    <LearnLessonCard key={item.id} item={item} variant="list" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((item) => (
                    <LearnLessonCard key={item.id} item={item} />
                  ))}
                </div>
              )}
              {(hasPrev || hasMore) && (
                <div className="flex items-center justify-center gap-4 mt-8">
                  {hasPrev && (
                    <Link href={prevHref} className="btn-secondary">
                      Previous
                    </Link>
                  )}
                  <span className="text-secondary text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  {hasMore && (
                    <Link href={nextHref} className="btn-secondary">
                      Next
                    </Link>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="card p-12 text-center">
              <p className="text-secondary">No lessons match your filters yet. Try a different level or category.</p>
              {level === "all" && !lockCategory && (
                <p className="text-secondary text-sm mt-2">If you have published content in the database, ensure <code className="bg-[var(--divider)]/50 px-1 rounded">DATABASE_URL</code> is set in your environment.</p>
              )}
              <Link href={basePath} className="text-primary font-medium mt-2 inline-block hover:underline">
                Clear filters →
              </Link>
            </div>
          )}
        </div>

        {/* Soft bundle CTA */}
        <div className="mb-10">
          <LearnBundleCta level={level} />
        </div>

        
      </div>
    </div>
  );
}
