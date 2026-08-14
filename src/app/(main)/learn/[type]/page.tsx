import { notFound } from "next/navigation";
import {
  LEARN_CONTENT_TYPES,
  LEARN_TYPE_LABELS,
  normalizeLearnLevel,
  type LearnContentType,
} from "@/lib/learn-filters";
import { LearnContent } from "@/components/learn/LearnContent";
import { getLearnCatalog } from "@/lib/learn/getLearnCatalog";
import { getDirectoryItems } from "@/lib/learn/getDirectoryItems";
import { getSession } from "@/lib/auth/session";
import { clampTitle, clampDescription, canonicalUrl } from "@/lib/seo";

const LEARN_TYPE_METADATA: Record<string, { title: string; description: string }> = {
  grammar: {
    title: "JLPT Grammar Lessons from N5 to N1",
    description: "Browse structured Japanese grammar points by JLPT level, with meanings, examples, and usage notes.",
  },
  vocabulary: {
    title: "JLPT Vocabulary Lists with Readings and Examples",
    description: "Browse Japanese vocabulary by JLPT level, with kana readings, meanings, and part of speech.",
  },
  kanji: {
    title: "JLPT Kanji Meanings, Readings & Writing Practice",
    description: "Browse Kanji characters by JLPT level with on-yomi/kun-yomi readings, meanings, and stroke-order practice.",
  },
  reading: {
    title: "Japanese Reading Practice from N5 to N1",
    description: "Read real Japanese passages by JLPT level with comprehension questions and vocabulary notes.",
  },
  writing: {
    title: "Hiragana, Katakana & Kanji Writing Practice",
    description: "Practice writing hiragana, katakana, and kanji with guided stroke-order canvases.",
  },
  listening: {
    title: "Japanese Listening Practice by JLPT Level",
    description: "Practice listening comprehension with Japanese audio scenarios organized by JLPT level.",
  },
  sounds: {
    title: "Japanese Pronunciation & Sounds Practice",
    description: "Practice Japanese pronunciation and sound recognition by JLPT level.",
  },
  study_guide: {
    title: "JLPT Study Guides and Practice Exercises",
    description: "Structured JLPT study guides and practice exercises by level.",
  },
  practice_test: {
    title: "JLPT Practice Tests",
    description: "JLPT-style practice tests to check your readiness at each level.",
  },
};

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ level?: string; search?: string; sort?: string; page?: string }>;
}) {
  const { type } = await params;
  const meta = LEARN_TYPE_METADATA[type.toLowerCase()];
  if (!meta) return {};

  const sp = await searchParams;
  const level = sp.level && sp.level !== "all" ? sp.level.toUpperCase() : "";
  const search = sp.search?.trim();
  const page = Math.max(1, parseInt(sp.page || "1", 10));

  const titleParts = [meta.title];
  if (level) titleParts.push(level);
  if (search) titleParts.push(`"${search}"`);
  if (page > 1) titleParts.push(`Page ${page}`);
  const title = clampTitle(`${titleParts.join(" · ")} | Japanese with Avnish`);

  const descSuffix = [level ? `Filtered to JLPT ${level}.` : "", page > 1 ? `Page ${page}.` : ""]
    .filter(Boolean)
    .join(" ");
  const description = clampDescription(`${meta.description}${descSuffix ? ` ${descSuffix}` : ""}`);

  const qs = new URLSearchParams();
  if (level) qs.set("level", level.toLowerCase());
  if (sp.sort && sp.sort !== "newest") qs.set("sort", sp.sort);
  if (page > 1) qs.set("page", String(page));
  const path = qs.toString() ? `/learn/${type}?${qs.toString()}` : `/learn/${type}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: canonicalUrl(path), type: "website", images: ["/og-default.png"] },
  };
}

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

  const session = normalizedType === "vocabulary" ? await getSession() : null;
  const directoryItems = level !== "all" && ["grammar", "vocabulary", "kanji", "listening", "writing"].includes(normalizedType)
    ? await getDirectoryItems(normalizedType as "grammar" | "vocabulary" | "kanji" | "listening" | "writing", level, session?.email)
    : [];

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
      directoryItems={directoryItems}
    />
  );
}
