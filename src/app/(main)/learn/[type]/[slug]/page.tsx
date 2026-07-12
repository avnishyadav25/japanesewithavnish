import { getLearnDetailMetadata, LearnDetailContent } from "@/components/learn/LearnDetailContent";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ type: string; slug: string }>;
}) {
  const { type, slug } = await params;
  return getLearnDetailMetadata({ typeSegment: type, postSlug: slug, canonicalBase: "/learn" });
}

export default async function LearnDetailPage({
  params,
}: {
  params: Promise<{ type: string; slug: string }>;
}) {
  const { type, slug } = await params;
  return LearnDetailContent({ typeSegment: type, postSlug: slug, breadcrumbBase: "/learn" });
}
