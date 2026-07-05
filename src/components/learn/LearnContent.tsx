"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LearnLevelTabs } from "./LearnLevelTabs";
import { LearnCategoryGrid } from "./LearnCategoryGrid";
import { LearnFilterBar } from "./LearnFilterBar";
import { LearnLessonCard } from "./LearnLessonCard";
import { LearnBundleCta } from "./LearnBundleCta";
import { WritingPracticeModal } from "./WritingPracticeModal";
import type { LearnLevel } from "@/lib/learn-filters";
import type { LearnItemForFilter } from "@/lib/learn-filters";
import type { DirectoryItem } from "@/lib/learn/getDirectoryItems";

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
  directoryItems?: DirectoryItem[];
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
  directoryItems = [],
}: LearnContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchFromUrl = searchParams?.get("search") ?? "";
  const [searchInput, setSearchInput] = useState(searchFromUrl);

  // Writing Modal State
  const [writingChar, setWritingChar] = useState("");
  const [writingType, setWritingType] = useState<"kanji" | "hiragana" | "katakana">("kanji");
  const [writingStrokes, setWritingStrokes] = useState<number | null>(null);
  const [writingReading, setWritingReading] = useState<string | null>(null);
  const [writingMeaning, setWritingMeaning] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const levelsInfo = [
    { code: "n5", title: "N5", label: "Beginner" },
    { code: "n4", title: "N4", label: "Elementary" },
    { code: "n3", title: "N3", label: "Intermediate" },
    { code: "n2", title: "N2", label: "Upper Intermediate" },
    { code: "n1", title: "N1", label: "Advanced" },
  ];

  const handleLevelSelect = (levelCode: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("level", levelCode);
    params.delete("page");
    router.push(`${basePath}?${params.toString()}`);
  };

  const handleOpenWritingModal = (
    char: string,
    type: "kanji" | "hiragana" | "katakana",
    strokes: number | null | undefined,
    reading: string | null | undefined,
    meaning: string | null | undefined
  ) => {
    setWritingChar(char);
    setWritingType(type);
    setWritingStrokes(strokes ?? null);
    setWritingReading(reading ?? null);
    setWritingMeaning(meaning ?? null);
    setIsModalOpen(true);
  };

  return (
    <div className="py-12 sm:py-16 px-4 sm:px-6">
      <div className="max-w-[1200px] mx-auto">
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
                className="flex-1 min-w-0 px-4 py-2.5 border border-[var(--divider)] rounded-md text-charcoal placeholder:text-[#555555] bg-white text-sm"
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

        {/* Level filter layout */}
        {lockCategory ? (
          /* Locked Category Page: 5 Level Boxes */
          <div className="mb-10">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {levelsInfo.map((l) => {
                const active = level.toLowerCase() === l.code;
                return (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => handleLevelSelect(l.code)}
                    className={`card p-6 text-center flex flex-col justify-center items-center hover:shadow-md transition border-2 ${
                      active
                        ? "border-primary bg-[#FFF7F7] ring-1 ring-primary/20"
                        : "border-[var(--divider)] bg-white hover:border-primary/50"
                    }`}
                  >
                    <span className="text-3xl font-bold text-charcoal">{l.title}</span>
                    <span className="text-secondary text-xs mt-1.5 font-medium">{l.label}</span>
                  </button>
                );
              })}
            </div>
            {level !== "all" && (
              <div className="mt-4 text-right">
                <button
                  type="button"
                  onClick={() => handleLevelSelect("all")}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  Clear level filter
                </button>
              </div>
            )}
          </div>
        ) : (
          /* General Category Landing Page: Tabs */
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
        )}

        {/* Dynamic Directory List (only shown when a specific category and level are active) */}
        {lockCategory && level !== "all" && directoryItems && directoryItems.length > 0 && (
          <div className="mb-12 bg-white border border-[var(--divider)] rounded-2xl p-6 sm:p-8 shadow-sm">
            <div className="mb-6">
              <h2 className="font-heading text-2xl font-bold text-charcoal">
                All {level.toUpperCase()} {lockCategory.charAt(0).toUpperCase() + lockCategory.slice(1)} Directory
              </h2>
              <p className="text-secondary text-sm mt-1">
                Complete directory index of all {level.toUpperCase()} {lockCategory.toLowerCase()} content ({directoryItems.length} items).
              </p>
            </div>

            {/* Grammar Directory Grid */}
            {lockCategory === "grammar" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {directoryItems.map((item) => (
                  <div key={item.id} className="p-4 rounded-xl border border-[var(--divider)] bg-[#FAF8F5] flex flex-col justify-between hover:shadow-md transition">
                    <div>
                      <span className="font-bold text-charcoal text-base">{item.title}</span>
                      <p className="text-secondary text-xs mt-1.5 leading-relaxed">{item.notes}</p>
                    </div>
                    {item.slug && (
                      <Link href={`/learn/grammar/${item.slug}`} className="text-primary text-xs font-semibold mt-4 hover:underline inline-block">
                        View lesson →
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Vocabulary Directory Grid */}
            {lockCategory === "vocabulary" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {directoryItems.map((item) => (
                  <div key={item.id} className="p-4 rounded-xl border border-[var(--divider)] bg-[#FAF8F5] flex flex-col justify-between hover:shadow-md transition">
                    <div>
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-bold text-charcoal text-lg">{item.title}</span>
                        {item.subtitle && (
                          <span className="text-secondary text-xs font-medium">({item.subtitle})</span>
                        )}
                      </div>
                      <p className="text-secondary text-sm mt-1.5 font-medium">{item.meaning}</p>
                      {item.notes && (
                        <p className="text-[#777] text-xs mt-1 leading-relaxed italic">{item.notes}</p>
                      )}
                    </div>
                    {item.slug && (
                      <Link href={`/learn/vocabulary/${item.slug}`} className="text-primary text-xs font-semibold mt-4 hover:underline inline-block">
                        View lesson →
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Kanji Directory Grid */}
            {lockCategory === "kanji" && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {directoryItems.map((item) => (
                  <div key={item.id} className="p-4 rounded-xl border border-[var(--divider)] bg-[#FAF8F5] flex flex-col justify-between hover:shadow-md transition text-center">
                    <div>
                      <span className="text-3xl font-bold text-charcoal block mb-2">{item.title}</span>
                      <p className="text-charcoal font-semibold text-xs truncate" title={item.meaning}>{item.meaning}</p>
                      {(item.onyomi?.length || item.kunyomi?.length) && (
                        <p className="text-secondary text-[11px] truncate mt-0.5">
                          {([...(item.onyomi || []), ...(item.kunyomi || [])]).slice(0, 2).join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="mt-4 space-y-2">
                      <button
                        type="button"
                        onClick={() => handleOpenWritingModal(item.title, "kanji", item.strokeCount, item.subtitle || item.meaning, item.meaning)}
                        className="w-full text-[11px] py-1 border border-primary/40 text-primary font-bold rounded hover:bg-primary/5 transition"
                      >
                        Practice Drawing
                      </button>
                      {item.slug && (
                        <Link href={`/learn/kanji/${item.slug}`} className="text-primary text-xs block font-bold hover:underline">
                          View lesson →
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Listening Directory List */}
            {lockCategory === "listening" && (
              <div className="space-y-4">
                {directoryItems.map((item) => (
                  <div key={item.id} className="p-5 rounded-xl border border-[var(--divider)] bg-[#FAF8F5] hover:shadow-md transition">
                    <h3 className="font-heading text-base font-bold text-charcoal mb-2">{item.title}</h3>
                    {item.meaning && (
                      <pre className="text-[#444] text-xs bg-white p-4 rounded-bento border border-[var(--divider)] overflow-x-auto font-sans whitespace-pre-wrap mb-4 leading-relaxed">
                        {item.meaning}
                      </pre>
                    )}
                    {item.notes && (
                      <div className="mt-2">
                        <audio src={item.notes} controls className="w-full max-w-md h-9" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Writing Directory Grid */}
            {lockCategory === "writing" && (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {directoryItems.map((item) => (
                  <div key={item.id} className="p-3 rounded-xl border border-[var(--divider)] bg-[#FAF8F5] flex flex-col justify-between hover:shadow-md transition text-center">
                    <div>
                      <span className="text-3xl font-bold text-charcoal block mb-1">{item.title}</span>
                      <p className="text-secondary text-[11px] truncate">({item.subtitle || item.meaning})</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenWritingModal(item.title, (item.type as "kanji" | "hiragana" | "katakana" | undefined) || "kanji", item.strokeCount, item.subtitle || item.meaning, item.meaning)}
                      className="w-full text-xs py-1.5 bg-primary text-white font-semibold rounded hover:bg-primary/95 transition mt-3"
                    >
                      Draw Canvas
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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

      {/* Writing practice popup modal */}
      <WritingPracticeModal
        character={writingChar}
        characterType={writingType}
        expectedStrokeCount={writingStrokes}
        reading={writingReading}
        meaning={writingMeaning}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
