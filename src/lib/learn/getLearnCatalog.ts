import { sql } from "@/lib/db";
import {
  filterLearnItems,
  type LearnContentType,
  type LearnItemForFilter,
  type LearnLevel,
} from "@/lib/learn-filters";

const PER_PAGE = 12;

function matchesLevel(itemLevel: string | null, filterLevel: LearnLevel): boolean {
  if (filterLevel === "all") return true;
  if (!itemLevel) return false;
  return itemLevel.toUpperCase() === filterLevel.toUpperCase();
}

export async function getLearnCatalog({
  contentType,
  level,
  category,
  search,
  sort,
  page,
  respectCuratedLevel,
}: {
  contentType?: LearnContentType;
  level: LearnLevel;
  category: string;
  search: string;
  sort: "recommended" | "newest";
  page: number;
  /**
   * When true, curated recommendations are filtered to match the requested `level`.
   * Current code behavior differs between `learn/page.tsx` and `learn/[type]/page.tsx`,
   * so we keep this configurable to avoid behavior regressions.
   */
  respectCuratedLevel: boolean;
}): Promise<{
  recommendedItems: LearnItemForFilter[];
  paginatedItems: LearnItemForFilter[];
  totalCount: number;
  currentPage: number;
}> {
  let allItems: LearnItemForFilter[] = [];
  let recommendedByLevel: Record<string, string[]> = {};

  if (sql) {
    try {
      const [contentRows, settingsRows] = await Promise.all([
        contentType
          ? sql`
              SELECT id, slug, title, content, content_type,
                     (jlpt_level)[1] AS jlpt_level, tags, meta, status, sort_order, created_at, updated_at
              FROM posts
              WHERE content_type = ${contentType} AND status = 'published'
              ORDER BY sort_order ASC, created_at DESC
              LIMIT 200
            `
          : sql`
              SELECT id, slug, title, content, content_type,
                     (jlpt_level)[1] AS jlpt_level, tags, meta, status, sort_order, created_at, updated_at
              FROM posts
              WHERE content_type IN ('grammar','vocabulary','kanji','reading','writing','listening','sounds','study_guide','practice_test')
                AND status = 'published'
              ORDER BY sort_order ASC, created_at DESC
              LIMIT 200
            `,
        sql`SELECT value FROM site_settings WHERE key = 'learn_recommended' LIMIT 1`,
      ]);

      allItems = (Array.isArray(contentRows) ? contentRows : []) as LearnItemForFilter[];

      const settingsRow = (Array.isArray(settingsRows) ? settingsRows[0] : settingsRows) as
        | { value: Record<string, string[]> }
        | undefined;
      recommendedByLevel =
        settingsRow?.value && typeof settingsRow.value === "object" ? settingsRow.value : {};
    } catch (err) {
      console.error("[Learn] Failed to fetch learning_content:", err);
    }
  }

  const curatedSlugs = recommendedByLevel[level] ?? recommendedByLevel.all ?? [];

  const filtered = filterLearnItems(allItems, level, category, search);

  const itemBySlug = new Map(allItems.map((i) => [i.slug, i]));
  const curatedSet = new Set(curatedSlugs);

  const sortOrderById = new Map(allItems.map((i) => [i.id, i.sort_order ?? 0]));
  const createdAtMsById = new Map(
    allItems.map((i) => [i.id, new Date(i.created_at || 0).getTime()])
  );

  const recommendedItems: LearnItemForFilter[] = [];
  const seen = new Set<string>();

  for (const slug of curatedSlugs.slice(0, 6)) {
    const item = itemBySlug.get(slug);
    if (!item) continue;
    if (seen.has(item.id)) continue;
    if (respectCuratedLevel && !matchesLevel(item.jlpt_level, level)) continue;
    recommendedItems.push(item);
    seen.add(item.id);
  }

  // Fill remaining slots from the filtered list.
  for (const item of filtered) {
    if (recommendedItems.length >= 6) break;
    if (seen.has(item.id)) continue;
    recommendedItems.push(item);
    seen.add(item.id);
  }

  const sorted =
    sort === "recommended"
      ? [...filtered].sort((a, b) => {
          const aCurated = curatedSet.has(a.slug);
          const bCurated = curatedSet.has(b.slug);
          if (aCurated && !bCurated) return -1;
          if (!aCurated && bCurated) return 1;
          return (
            (sortOrderById.get(a.id) ?? 0) - (sortOrderById.get(b.id) ?? 0) ||
            (createdAtMsById.get(b.id) ?? 0) - (createdAtMsById.get(a.id) ?? 0)
          );
        })
      : [...filtered].sort(
          (a, b) =>
            (createdAtMsById.get(b.id) ?? 0) - (createdAtMsById.get(a.id) ?? 0)
        );

  const recommendedIds = new Set(recommendedItems.map((i) => i.id));
  const listItems = sorted.filter((i) => !recommendedIds.has(i.id));

  const totalCount = listItems.length;
  const totalPages = Math.ceil(totalCount / PER_PAGE) || 1;
  const currentPage = Math.min(page, totalPages);

  const paginatedItems = listItems.slice(
    (currentPage - 1) * PER_PAGE,
    currentPage * PER_PAGE
  );

  return {
    recommendedItems,
    paginatedItems,
    totalCount,
    currentPage,
  };
}

