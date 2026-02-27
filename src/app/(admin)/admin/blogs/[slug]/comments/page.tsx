import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { CommentsManager } from "./CommentsManager";

export default async function AdminBlogCommentsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createAdminClient();

  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("id, title, slug")
    .eq("slug", slug)
    .single();

  if (postError || !post) notFound();

  const { data: comments } = await supabase
    .from("post_comments")
    .select("id, author_name, author_email, content, status, created_at")
    .eq("post_id", post.id)
    .order("created_at", { ascending: false });

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
        {comments && comments.length > 0 ? (
          <CommentsManager comments={comments} />
        ) : (
          <p className="text-secondary py-8 text-center">No comments yet.</p>
        )}
      </AdminCard>
    </div>
  );
}
