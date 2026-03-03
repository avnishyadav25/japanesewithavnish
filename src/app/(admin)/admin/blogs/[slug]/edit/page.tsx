import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { BlogPostForm } from "../../BlogPostForm";

export default async function AdminBlogsEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!sql) notFound();

  const rows = await sql`SELECT * FROM posts WHERE slug = ${slug} LIMIT 1`;
  const post = rows[0] as Record<string, unknown> | undefined;
  if (!post) notFound();

  return (
    <div>
      <AdminPageHeader
        title="Edit post"
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Blogs", href: "/admin/blogs" },
          { label: post.title as string },
        ]}
        actions={[
          { label: "Social generator", href: `/admin/social/prepare?type=blog&slug=${encodeURIComponent(slug)}` },
        ]}
      />
      <BlogPostForm post={post as unknown as Parameters<typeof BlogPostForm>[0]["post"]} />
    </div>
  );
}
