import { redirect } from "next/navigation";

export default async function LearnEditRedirect({
  params,
}: {
  params: Promise<{ type: string; slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/admin/blogs/${slug}/edit`);
}
