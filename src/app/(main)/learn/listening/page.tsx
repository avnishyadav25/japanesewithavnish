import { getLearnCatalog } from "@/lib/learn/getLearnCatalog";
import { getDirectoryItems } from "@/lib/learn/getDirectoryItems";
import { normalizeLearnLevel } from "@/lib/learn-filters";
import { LearnContent } from "@/components/learn/LearnContent";
import { clampTitle, clampDescription, canonicalUrl } from "@/lib/seo";

type ListeningSearchParams = { level?: string; search?: string; sort?: string; page?: string };

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<ListeningSearchParams>;
}) {
  const sp = await searchParams;
  const level = sp.level && sp.level !== "all" ? sp.level.toUpperCase() : "";
  const page = Math.max(1, parseInt(sp.page || "1", 10));
  const titleParts = ["Japanese Listening Practice"];
  if (level) titleParts.push(`JLPT ${level}`);
  if (page > 1) titleParts.push(`Page ${page}`);
  const title = clampTitle(`${titleParts.join(" · ")} | Japanese with Avnish`);
  const description = clampDescription(
    `Practice listening comprehension with Japanese audio scenarios${level ? ` for JLPT ${level}` : " organized by JLPT level"}.${page > 1 ? ` Page ${page}.` : ""}`
  );
  const qs = new URLSearchParams();
  if (level) qs.set("level", level.toLowerCase());
  if (page > 1) qs.set("page", String(page));
  const path = qs.toString() ? `/learn/listening?${qs.toString()}` : "/learn/listening";
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: canonicalUrl(path), type: "website", images: ["/og-default.png"] },
  };
}

export default async function LearnListeningPage({
  searchParams,
}: {
  searchParams: Promise<ListeningSearchParams>;
}) {
  const sp = await searchParams;
  const level = normalizeLearnLevel(sp.level || "all");
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
