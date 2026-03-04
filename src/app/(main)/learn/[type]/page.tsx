import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import {
  filterLearnItems,
  LEARN_CONTENT_TYPES,
  LEARN_TYPE_LABELS,
  normalizeLearnLevel,
  type LearnContentType,
  type LearnItemForFilter,
} from "@/lib/learn-filters";
import { LearnContent } from "@/components/learn/LearnContent";

const PER_PAGE = 12;

export const dynamic = "force-dynamic";

export default async function LearnTypePage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ level?: string; search?: string; sort?: string; page?: string }>;
}) {
  const { type } = await params;
  const normalizedType = type.toLowerCase();
  if (!LEARN_CONTENT_TYPES.includes(normalizedType as LearnContentType)) notFound();

  const sp = await searchParams;
  const level = normalizeLearnLevel(sp.level || "all");
  const search = (sp.search || "").trim();
  const sort = sp.sort === "recommended" ? "recommended" : "newest";
  const page = Math.max(1, parseInt(sp.page || "1", 10));

  const basePath = `/learn/${normalizedType}`;
  let allItems: LearnItemForFilter[] = [];
  let recommendedByLevel: Record<string, string[]> = {};

  if (sql) {
    try {
      const [contentRows, settingsRows] = await Promise.all([
        sql`SELECT id, slug, title, content, content_type, jlpt_level, tags, meta, status, sort_order, created_at, updated_at FROM learning_content WHERE content_type = ${normalizedType} AND status = 'published' ORDER BY sort_order ASC, created_at DESC LIMIT 200`,
        sql`SELECT value FROM site_settings WHERE key = 'learn_recommended' LIMIT 1`,
      ]);
      allItems = (Array.isArray(contentRows) ? contentRows : []) as LearnItemForFilter[];
      const settingsRow = (Array.isArray(settingsRows) ? settingsRows[0] : settingsRows) as { value: Record<string, string[]> } | undefined;
      recommendedByLevel = (settingsRow?.value && typeof settingsRow.value === "object") ? settingsRow.value : {};
    } catch (err) {
      console.error("[Learn type] Failed to fetch learning_content:", err);
    }
  }
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

  const recommendedIds = new Set(recommendedItems.map((i) => i.id));
  const listItems = sorted.filter((i) => !recommendedIds.has(i.id));

  const totalCount = listItems.length;
  const totalPages = Math.ceil(totalCount / PER_PAGE) || 1;
  const currentPage = Math.min(page, totalPages);
  const paginated = listItems.slice(
    (currentPage - 1) * PER_PAGE,
    currentPage * PER_PAGE
  );

  const label = LEARN_TYPE_LABELS[normalizedType as LearnContentType] || normalizedType;

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
