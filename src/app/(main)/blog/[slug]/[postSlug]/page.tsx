import { permanentRedirect } from "next/navigation";
import { getLearnDetailMetadata, LearnDetailContent } from "@/components/learn/LearnDetailContent";

/**
 * /blog/[type]/[slug] — only content_type='study_guide' renders here now (editorial content
 * stays canonical under /blog). Every other structured learning type (grammar/vocabulary/kanji/
 * reading/writing/listening/sounds/practice_test) permanently redirects to the real canonical
 * home at /learn/[type]/[slug], per the blog/learn split (P0-9).
 */
const EDITORIAL_TYPES_STAYING_UNDER_BLOG = ["study_guide"];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; postSlug: string }>;
}) {
  const { slug: typeSegment, postSlug } = await params;
  const normalized = typeSegment.toLowerCase();
  if (!EDITORIAL_TYPES_STAYING_UNDER_BLOG.includes(normalized)) return {};
  return getLearnDetailMetadata({ typeSegment: normalized, postSlug, canonicalBase: "/blog" });
}

export default async function BlogLearnDetailPage({
  params,
}: {
  params: Promise<{ slug: string; postSlug: string }>;
}) {
  const { slug: typeSegment, postSlug } = await params;
  const normalized = typeSegment.toLowerCase();

  if (!EDITORIAL_TYPES_STAYING_UNDER_BLOG.includes(normalized)) {
    permanentRedirect(`/learn/${normalized}/${postSlug}`);
  }

  return LearnDetailContent({ typeSegment: normalized, postSlug, breadcrumbBase: "/blog" });
}
