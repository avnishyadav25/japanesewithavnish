import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  filterLearnItems,
  normalizeLearnLevel,
  type LearnItemForFilter,
} from "@/lib/learn-filters";
import { LearnContent } from "@/components/learn/LearnContent";

const TYPES = ["grammar", "vocabulary", "kanji", "reading", "writing"] as const;
const TYPE_LABELS: Record<string, string> = {
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  kanji: "Kanji",
  reading: "Reading",
  writing: "Writing",
};

const PER_PAGE = 12;

export default async function LearnTypePage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ level?: string; search?: string; sort?: string; page?: string }>;
}) {
  const { type } = await params;
  const normalizedType = type.toLowerCase();
  if (!TYPES.includes(normalizedType as (typeof TYPES)[number])) notFound();

  const sp = await searchParams;
  const level = normalizeLearnLevel(sp.level || "all");
  const search = (sp.search || "").trim();
  const sort = sp.sort === "recommended" ? "recommended" : "newest";
  const page = Math.max(1, parseInt(sp.page || "1", 10));

  const basePath = `/learn/${normalizedType}`;
  const supabase = await createClient();

  const [contentRes, settingsRes] = await Promise.all([
    supabase
      .from("learning_content")
      .select("id, slug, title, content, content_type, jlpt_level, tags, meta, status, sort_order, created_at, updated_at")
      .eq("content_type", normalizedType)
      .eq("status", "published")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("site_settings")
      .select("key, value")
      .eq("key", "learn_recommended")
      .maybeSingle(),
  ]);

  const allItems = (contentRes.data || []) as LearnItemForFilter[];
  const recommendedByLevel = (settingsRes.data?.value as Record<string, string[]>) || {};
  const curatedSlugs = recommendedByLevel[level] ?? recommendedByLevel.all ?? [];

  const filtered = filterLearnItems(allItems, level, normalizedType, search);

  const recommendedItems: LearnItemForFilter[] = [];
  const seen = new Set<string>();
  for (const slug of curatedSlugs.slice(0, 6)) {
    const item = allItems.find((i) => i.slug === slug);
    if (item && !seen.has(item.id)) {
      recommendedItems.push(item);
      seen.add(item.id);
    }
  }
  const need = 6 - recommendedItems.length;
  if (need > 0) {
    for (const item of filtered) {
      if (recommendedItems.length >= 6) break;
      if (!seen.has(item.id)) {
        recommendedItems.push(item);
        seen.add(item.id);
      }
    }
  }

  const sorted =
    sort === "recommended"
      ? [...filtered].sort((a, b) => {
          const aCurated = curatedSlugs.includes(a.slug);
          const bCurated = curatedSlugs.includes(b.slug);
          if (aCurated && !bCurated) return -1;
          if (!aCurated && bCurated) return 1;
          return (a.sort_order ?? 0) - (b.sort_order ?? 0) || new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        })
      : [...filtered].sort(
          (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );

  const totalCount = sorted.length;
  const totalPages = Math.ceil(totalCount / PER_PAGE) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginated = sorted.slice(
    (currentPage - 1) * PER_PAGE,
    currentPage * PER_PAGE
  );

  const label = TYPE_LABELS[normalizedType] || normalizedType;

  return (
    <LearnContent
      level={level}
      category={normalizedType}
      sort={sort}
      recommended={recommendedItems}
      items={paginated}
      totalCount={totalCount}
      currentPage={currentPage}
      basePath={basePath}
      lockCategory={normalizedType}
      heroTitle={label}
      heroSubtext={`Browse ${label.toLowerCase()} content by JLPT level.`}
    />
  );
}
