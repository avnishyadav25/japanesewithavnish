import { redirect } from "next/navigation";

export default async function LearnDetailRedirect({
  params,
}: {
  params: Promise<{ type: string; slug: string }>;
}) {
  const { type, slug } = await params;
  redirect(`/blog/${type}/${slug}`);
}
