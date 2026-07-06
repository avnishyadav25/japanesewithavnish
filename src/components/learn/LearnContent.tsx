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

  const getSearchPlaceholder = () => {
    if (lockCategory === "grammar") return "Search grammar patterns...";
    if (lockCategory === "vocabulary") return "Search vocabulary words...";
    if (lockCategory === "kanji") return "Search kanji, meaning, or reading...";
    if (lockCategory === "listening") return "Search listening practice...";
    if (lockCategory === "writing") return "Search kana or kanji...";
    return "Search grammar, kanji, vocab...";
  };

  return (
    <div className="py-12 sm:py-16 px-4 sm:px-6">
      <div className="max-w-[1200px] mx-auto space-y-10">
        {/* Hero: title left, search + links top right */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div>
            <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal mb-2">
              {heroTitle}
            </h1>
            <p className="text-secondary text-sm">
              {heroSubtext}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto md:min-w-[280px]">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1 sm:flex-initial">
              <input
                type="search"
                placeholder={getSearchPlaceholder()}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="flex-1 min-w-0 px-4 py-2.5 border border-[var(--divider)] rounded-md text-charcoal placeholder:text-[#555555] bg-white text-sm"
              />
              <button type="submit" className="btn-primary px-4 shrink-0">
                Search
              </button>
            </form>
            <div className="flex gap-4 text-sm shrink-0">
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
          <div>
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
                        ? "border-[#D0021B] bg-[#D0021B] text-white"
                        : "border-[#EEEEEE] bg-white hover:border-[#D0021B]/40 text-[#1A1A1A]"
                    }`}
                  >
                    <span className="text-3xl font-bold">{l.title}</span>
                    <span className={`text-xs mt-1.5 font-medium ${active ? "text-white/80" : "text-secondary"}`}>{l.label}</span>
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
          <div className="card p-5">
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

        {/* Dynamic Directory List */}
        {lockCategory && level !== "all" && directoryItems && directoryItems.length > 0 && (() => {
          const selectedView = searchParams?.get("view") ?? "gallery";
          const levelsInfo = [
            { code: "n5", title: "N5" },
            { code: "n4", title: "N4" },
            { code: "n3", title: "N3" },
            { code: "n2", title: "N2" },
            { code: "n1", title: "N1" },
          ];

          const getViewLink = (v: string) => {
            const params = new URLSearchParams(searchParams?.toString() ?? "");
            params.set("view", v);
            return `${basePath}?${params.toString()}`;
          };

          return (
            <div className="bg-white border border-[var(--divider)] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--divider)] pb-4">
                <div>
                  <h2 className="font-heading text-2xl font-bold text-charcoal">
                    All {level.toUpperCase()} {lockCategory.charAt(0).toUpperCase() + lockCategory.slice(1)} Directory
                  </h2>
                  <p className="text-secondary text-sm mt-1">
                    Complete directory index of all {level.toUpperCase()} {lockCategory.toLowerCase()} content ({directoryItems.length} items).
                  </p>
                </div>

                {/* Layout view selectors */}
                <div className="flex items-center gap-1 bg-white border border-[#EEEEEE] p-1 rounded-lg self-start sm:self-center">
                  {["gallery", "table", "list"].map((v) => {
                    const active = selectedView === v;
                    return (
                      <Link
                        key={v}
                        href={getViewLink(v)}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition ${
                          active ? "bg-primary/10 text-primary" : "text-secondary hover:text-charcoal"
                        }`}
                      >
                        {v}
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* GALLERY VIEW (Default) */}
              {selectedView === "gallery" && (
                <>
                  {lockCategory === "grammar" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {directoryItems.map((item) => (
                        <div key={item.id} className="p-5 rounded-2xl border border-[#EEEEEE] bg-white flex flex-col justify-between hover:shadow-md transition">
                          <div>
                            <span className="inline-block text-[9px] font-bold text-secondary bg-base border border-[var(--divider)] px-2 py-0.5 rounded uppercase">
                              {level.toUpperCase()} • Grammar
                            </span>
                            <h3 className="font-bold text-charcoal text-sm mt-2">{item.title}</h3>
                            <p className="text-secondary text-xs mt-2 leading-relaxed">{item.notes}</p>
                          </div>
                          {item.slug && (
                            <Link href={`/learn/grammar/${item.slug}`} className="text-primary text-xs font-bold mt-4 hover:underline inline-block">
                              Read →
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {lockCategory === "vocabulary" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {directoryItems.map((item) => (
                        <div key={item.id} className="p-5 rounded-2xl border border-[#EEEEEE] bg-white flex flex-col justify-between hover:shadow-md transition">
                          <div>
                            <span className="inline-block text-[9px] font-bold text-secondary bg-base border border-[var(--divider)] px-2 py-0.5 rounded uppercase">
                              {level.toUpperCase()} • Vocabulary
                            </span>
                            <div className="flex items-baseline gap-2 flex-wrap mt-2">
                              <h3 className="font-bold text-charcoal text-base">{item.title}</h3>
                              {item.subtitle && (
                                <span className="text-secondary text-xs font-bold">({item.subtitle})</span>
                              )}
                            </div>
                            <p className="text-charcoal font-semibold text-xs mt-2">{item.meaning}</p>
                            {item.notes && (
                              <p className="text-[#777] text-[11px] mt-1 italic">{item.notes}</p>
                            )}
                          </div>
                          {item.slug && (
                            <Link href={`/learn/vocabulary/${item.slug}`} className="text-primary text-xs font-bold mt-4 hover:underline inline-block">
                              Read →
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {lockCategory === "kanji" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {directoryItems.map((item) => (
                        <div key={item.id} className="p-5 rounded-2xl border border-[#EEEEEE] bg-white flex flex-col justify-between hover:shadow-md transition text-center">
                          <div>
                            <span className="text-[42px] font-bold text-charcoal block mb-1">{item.title}</span>
                            <span className="inline-block text-[9px] font-bold text-secondary bg-base border border-[var(--divider)] px-2 py-0.5 rounded mb-2 uppercase">
                              {level.toUpperCase()} • Kanji
                            </span>
                            <p className="text-charcoal font-bold text-xs truncate" title={item.meaning}>{item.meaning}</p>
                            {(item.onyomi?.length || item.kunyomi?.length) && (
                              <p className="text-secondary text-[10px] mt-1">
                                {([...(item.onyomi || []), ...(item.kunyomi || [])]).slice(0, 2).join(", ")}
                              </p>
                            )}
                          </div>
                          <div className="mt-4 space-y-2">
                            <button
                              type="button"
                              onClick={() => handleOpenWritingModal(item.title, "kanji", item.strokeCount, item.subtitle || item.meaning, item.meaning)}
                              className="w-full text-[10px] py-1.5 border border-primary/45 text-primary font-bold rounded-lg hover:bg-primary/5 transition"
                            >
                              Practice stroke order →
                            </button>
                            {item.slug && (
                              <Link href={`/learn/kanji/${item.slug}`} className="text-primary text-xs block font-bold hover:underline">
                                Read →
                              </Link>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {lockCategory === "listening" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {directoryItems.map((item) => (
                        <div key={item.id} className="p-5 rounded-2xl border border-[#EEEEEE] bg-white hover:shadow-md transition flex flex-col justify-between">
                          <div>
                            <span className="inline-block text-[9px] font-bold text-secondary bg-base border border-[var(--divider)] px-2 py-0.5 rounded uppercase">
                              {level.toUpperCase()} • Listening • 3 min
                            </span>
                            <h3 className="font-heading text-sm font-black text-charcoal mt-2.5 mb-1">{item.title}</h3>
                            <p className="text-secondary text-xs">{item.meaning || "Practice common beginner dialogues."}</p>
                          </div>
                          {item.slug && (
                            <Link href={`/learn/listening/${item.slug}`} className="text-primary text-xs font-bold mt-4 hover:underline inline-block">
                              Start practice →
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {lockCategory === "writing" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {directoryItems.map((item) => (
                        <div key={item.id} className="p-5 rounded-2xl border border-[#EEEEEE] bg-white flex flex-col justify-between hover:shadow-md transition text-center">
                          <div>
                            <span className="text-3xl font-bold text-charcoal block mb-1">{item.title}</span>
                            <span className="inline-block text-[9px] font-bold text-secondary bg-base border border-[var(--divider)] px-2 py-0.5 rounded mb-2 uppercase">
                              {level.toUpperCase()} • Writing
                            </span>
                            <p className="text-secondary text-[11px] truncate mt-1">({item.subtitle || item.meaning})</p>
                          </div>
                          <div className="mt-4 space-y-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenWritingModal(item.title, (item.type as "kanji" | "hiragana" | "katakana" | undefined) || "kanji", item.strokeCount, item.subtitle || item.meaning, item.meaning)}
                              className="w-full text-[10px] py-1.5 bg-[#FAF8F5] text-charcoal font-bold rounded-lg border border-[var(--divider)] hover:bg-[var(--divider)]/20 transition"
                            >
                              Quick Draw
                            </button>
                            <Link href={`/learn/writing/${item.slug || "hiragana-a-row"}`} className="text-primary text-xs block font-bold hover:underline">
                              Practice stroke order →
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* TABLE VIEW */}
              {selectedView === "table" && (
                <div className="overflow-x-auto rounded-xl border border-[#EEEEEE]">
                  <table className="min-w-full divide-y divide-[#EEEEEE] bg-white text-left text-xs text-charcoal">
                    <thead className="bg-base font-bold text-secondary uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Term / Item</th>
                        <th className="px-4 py-3">Details / Reading</th>
                        <th className="px-4 py-3">Meaning / Description</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EEEEEE]">
                      {directoryItems.map((item) => (
                        <tr key={item.id} className="hover:bg-base/30 transition">
                          <td className="px-4 py-3 font-bold text-sm">{item.title}</td>
                          <td className="px-4 py-3 text-secondary">{item.subtitle || item.type || "—"}</td>
                          <td className="px-4 py-3 text-secondary truncate max-w-[300px]">{item.meaning || item.notes || "—"}</td>
                          <td className="px-4 py-3 text-right space-x-2">
                            {lockCategory === "kanji" || lockCategory === "writing" ? (
                              <button
                                type="button"
                                onClick={() => handleOpenWritingModal(item.title, (item.type as "kanji" | "hiragana" | "katakana" | undefined) || "kanji", item.strokeCount, item.subtitle || item.meaning, item.meaning)}
                                className="text-primary font-bold hover:underline"
                              >
                                Draw
                              </button>
                            ) : null}
                            {item.slug ? (
                              <Link href={`/learn/${lockCategory}/${item.slug}`} className="text-primary font-bold hover:underline">
                                View
                              </Link>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* LIST VIEW */}
              {selectedView === "list" && (
                <div className="space-y-3">
                  {directoryItems.map((item) => (
                    <div key={item.id} className="p-4 rounded-xl border border-[#EEEEEE] bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:shadow-sm transition">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-charcoal text-base">{item.title}</span>
                          {item.subtitle && (
                            <span className="text-secondary text-xs">({item.subtitle})</span>
                          )}
                          <span className="text-[9px] font-bold text-secondary bg-base px-2 py-0.5 rounded border border-[var(--divider)] uppercase">
                            {level.toUpperCase()} • {lockCategory}
                          </span>
                        </div>
                        <p className="text-secondary text-xs mt-1 leading-relaxed">
                          {item.meaning || item.notes || "Comprehensive study unit."}
                        </p>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-3">
                        {lockCategory === "kanji" || lockCategory === "writing" ? (
                          <button
                            type="button"
                            onClick={() => handleOpenWritingModal(item.title, (item.type as "kanji" | "hiragana" | "katakana" | undefined) || "kanji", item.strokeCount, item.subtitle || item.meaning, item.meaning)}
                            className="btn-secondary text-xs h-8 px-3 font-bold rounded-lg border border-[var(--divider)] flex items-center justify-center hover:bg-[#FAF8F5] transition"
                          >
                            Quick Draw
                          </button>
                        ) : null}
                        {item.slug ? (
                          <Link
                            href={`/learn/${lockCategory}/${item.slug}`}
                            className="btn-primary text-xs h-8 px-3 flex items-center justify-center rounded-lg"
                          >
                            Study →
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Recommended lessons */}
        {recommended.length > 0 && (
          <div className="space-y-4">
            <h2 className="font-heading text-xl font-bold text-charcoal">Recommended lessons</h2>
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
        <div className="space-y-4">
          <h2 className="font-heading text-xl font-bold text-charcoal">
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
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-8 text-xs font-bold font-heading">
                  <Link
                    href={hasPrev ? prevHref : "#"}
                    className={`btn-secondary h-9 px-4 flex items-center justify-center rounded-xl ${
                      !hasPrev ? "opacity-40 cursor-not-allowed pointer-events-none" : ""
                    }`}
                  >
                    ← Previous
                  </Link>
                  <span className="text-secondary">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Link
                    href={hasMore ? nextHref : "#"}
                    className={`btn-secondary h-9 px-4 flex items-center justify-center rounded-xl ${
                      !hasMore ? "opacity-40 cursor-not-allowed pointer-events-none" : ""
                    }`}
                  >
                    Next →
                  </Link>
                </div>
              )}
            </>
          ) : (
            <div className="card p-12 text-center bg-white border border-[var(--divider)] rounded-3xl">
              <p className="text-secondary text-xs">No lessons match your filters yet. Try a different level or category.</p>
              <Link href={basePath} className="text-primary font-bold mt-2 inline-block hover:underline">
                Clear filters →
              </Link>
            </div>
          )}
        </div>

        {/* Premium Subscription CTA */}
        <div>
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
