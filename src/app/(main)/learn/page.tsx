import {
  normalizeLearnLevel,
} from "@/lib/learn-filters";
import { LearnContent } from "@/components/learn/LearnContent";
import { getLearnCatalog } from "@/lib/learn/getLearnCatalog";

export const revalidate = 60;

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
  const sort = params.sort === "recommended" ? ("recommended" as const) : ("newest" as const);
  const page = Math.max(1, parseInt(params.page || "1", 10));

  const catalog = await getLearnCatalog({
    level,
    category,
    search,
    sort,
    page,
    respectCuratedLevel: true,
  });

  return (
    <LearnContent
      level={level}
      category={category}
      sort={sort}
      recommended={catalog.recommendedItems}
      items={catalog.paginatedItems}
      totalCount={catalog.totalCount}
      currentPage={catalog.currentPage}
    />
  );
}
