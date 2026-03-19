import { notFound } from "next/navigation";
import {
  LEARN_CONTENT_TYPES,
  LEARN_TYPE_LABELS,
  normalizeLearnLevel,
  type LearnContentType,
} from "@/lib/learn-filters";
import { LearnContent } from "@/components/learn/LearnContent";
import { getLearnCatalog } from "@/lib/learn/getLearnCatalog";

export const revalidate = 60;

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
  const sort = sp.sort === "recommended" ? ("recommended" as const) : ("newest" as const);
  const page = Math.max(1, parseInt(sp.page || "1", 10));

  const basePath = `/learn/${normalizedType}`;
  const catalog = await getLearnCatalog({
    contentType: normalizedType as LearnContentType,
    level,
    category: normalizedType,
    search,
    sort,
    page,
    respectCuratedLevel: false,
  });

  const label = LEARN_TYPE_LABELS[normalizedType as LearnContentType] || normalizedType;

  return (
    <LearnContent
      level={level}
      category={normalizedType}
      sort={sort}
      recommended={catalog.recommendedItems}
      items={catalog.paginatedItems}
      totalCount={catalog.totalCount}
      currentPage={catalog.currentPage}
      basePath={basePath}
      lockCategory={normalizedType}
      heroTitle={label}
      heroSubtext={`Browse ${label.toLowerCase()} content by JLPT level.`}
    />
  );
}
