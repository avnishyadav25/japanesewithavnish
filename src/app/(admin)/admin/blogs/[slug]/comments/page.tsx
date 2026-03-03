import { notFound } from "next/navigation";
import Link from "next/link";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { CommentsManager } from "./CommentsManager";

export const dynamic = "force-dynamic";

export default async function AdminBlogCommentsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!sql) notFound();

  const postRows = await sql`SELECT id, title, slug FROM posts WHERE slug = ${slug} LIMIT 1`;
  const post = postRows[0] as { id: string; title: string; slug: string } | undefined;
  if (!post) notFound();

  const commentsRows = await sql`
    SELECT id, author_name, author_email, content, status, created_at
    FROM post_comments WHERE post_id = ${post.id} ORDER BY created_at DESC
  `;
  const comments = (commentsRows ?? []) as { id: string; author_name: string; author_email: string; content: string; status: string; created_at: string }[];

  return (
    <div>
      <AdminPageHeader
        title={`Comments: ${post.title}`}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Blogs", href: "/admin/blogs" },
          { label: post.title, href: `/admin/blogs/${slug}/edit` },
          { label: "Comments" },
        ]}
      />
      <div className="mb-4">
        <Link
          href={`/admin/blogs/${slug}/edit`}
          className="text-primary text-sm hover:underline"
        >
          ← Back to edit post
        </Link>
      </div>
      <AdminCard>
        {comments.length > 0 ? (
          <CommentsManager comments={comments} />
        ) : (
          <p className="text-secondary py-8 text-center">No comments yet.</p>
        )}
      </AdminCard>
    </div>
  );
}
