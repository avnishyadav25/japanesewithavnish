import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { BlogListClient } from "./BlogListClient";

type PostRow = { id: string; slug: string; title: string; status: string; published_at: string | null; jlpt_level: string | string[] | null; og_image_url: string | null; summary: string | null };

export default async function AdminBlogsPage() {
  let posts: PostRow[] = [];
  let thisMonth = 0;

  if (sql) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const [postsRows, countRows] = await Promise.all([
      sql`SELECT id, slug, title, status, published_at, jlpt_level, og_image_url, summary FROM posts ORDER BY created_at DESC`,
      sql`SELECT COUNT(*)::int AS c FROM posts WHERE published_at >= ${monthStart}`,
    ]);
    posts = (postsRows ?? []) as PostRow[];
    thisMonth = (countRows[0] as { c: number })?.c ?? 0;
  }

  const total = posts.length;
  const published = posts.filter((p) => p.status === "published").length;
  const draft = total - published;

  if (posts.length === 0) {
    return (
      <div>
        <AdminPageHeader
          title="Blogs"
          breadcrumb={[{ label: "Admin", href: "/admin" }]}
          action={{ label: "New post", href: "/admin/blogs/new" }}
        />
        <AdminEmptyState
          message="No posts yet."
          action={{ label: "New post", href: "/admin/blogs/new" }}
        />
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Blogs"
        breadcrumb={[{ label: "Admin", href: "/admin" }]}
        actions={[
          { label: "Prepare for social", href: "/admin/social/prepare" },
          { label: "New post", href: "/admin/blogs/new" },
        ]}
      />
      <p className="text-sm text-secondary mb-4">
        <a href="/admin/ai-logs?entityType=post" className="text-primary hover:underline">AI history</a> (content & image generations for posts)
      </p>
      <BlogListClient
        posts={posts}
        stats={{ total, published, draft, thisMonth }}
      />
    </div>
  );
}
