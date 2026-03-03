import { sql } from "@/lib/db";
import {
  filterLearnItems,
  normalizeLearnLevel,
  type LearnItemForFilter,
} from "@/lib/learn-filters";
import { LearnContent } from "@/components/learn/LearnContent";

const PER_PAGE = 12;

export default async function LearnHubPage({
  searchParams,
}: {
  searchParams: Promise<{
    level?: string;
    category?: string;
    search?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const level = normalizeLearnLevel(params.level || "all");
  const category = (params.category || "all").toLowerCase();
  const search = (params.search || "").trim();
  const sort = params.sort === "recommended" ? "recommended" : "newest";
  const page = Math.max(1, parseInt(params.page || "1", 10));

  let allItems: LearnItemForFilter[] = [];
  let recommendedByLevel: Record<string, string[]> = {};

  if (sql) {
    const [contentRows, settingsRows] = await Promise.all([
      sql`SELECT id, slug, title, content, content_type, jlpt_level, tags, meta, status, sort_order, created_at, updated_at FROM learning_content WHERE status = 'published' ORDER BY sort_order ASC, created_at DESC LIMIT 200`,
      sql`SELECT value FROM site_settings WHERE key = 'learn_recommended' LIMIT 1`,
    ]);
    allItems = (contentRows || []) as LearnItemForFilter[];
    const settingsRow = settingsRows[0] as { value: Record<string, string[]> } | undefined;
    recommendedByLevel = settingsRow?.value || {};
  }
  const curatedSlugs = recommendedByLevel[level] ?? recommendedByLevel.all ?? [];

  const filtered = filterLearnItems(allItems, level, category, search);

  const recommendedItems: LearnItemForFilter[] = [];
  const seen = new Set<string>();
  for (const slug of curatedSlugs.slice(0, 6)) {
    const item = allItems.find((i) => i.slug === slug && filterLearnItems([i], level, "all", "").length > 0);
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

  return (
    <LearnContent
      level={level}
      category={category}
      sort={sort}
      recommended={recommendedItems}
      items={paginated}
      totalCount={totalCount}
      currentPage={currentPage}
    />
  );
}
