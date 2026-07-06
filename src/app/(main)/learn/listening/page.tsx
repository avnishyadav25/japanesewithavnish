import { getLearnCatalog } from "@/lib/learn/getLearnCatalog";
import { getDirectoryItems } from "@/lib/learn/getDirectoryItems";
import { normalizeLearnLevel } from "@/lib/learn-filters";
import { LearnContent } from "@/components/learn/LearnContent";



export default async function LearnListeningPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; search?: string; sort?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const level = normalizeLearnLevel(sp.level || "n5");
  const search = (sp.search || "").trim();
  const sort = sp.sort === "recommended" ? ("recommended" as const) : ("newest" as const);
  const page = Math.max(1, parseInt(sp.page || "1", 10));

  const catalog = await getLearnCatalog({
    contentType: "listening",
    level,
    category: "listening",
    search,
    sort,
    page,
    respectCuratedLevel: false,
  });

  const directoryItems = level !== "all"
    ? await getDirectoryItems("listening", level)
    : [];

  return (
    <LearnContent
      level={level}
      category="listening"
      sort={sort}
      recommended={catalog.recommendedItems}
      items={catalog.paginatedItems}
      totalCount={catalog.totalCount}
      currentPage={catalog.currentPage}
      basePath="/learn/listening"
      lockCategory="listening"
      heroTitle="Listening Comprehension"
      heroSubtext="Practice JLPT-style listening with audio, questions, and transcripts."
      directoryItems={directoryItems}
    />
  );
}
export const dynamic = "force-dynamic";
