import Link from "next/link";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { BlogListClient } from "./BlogListClient";

type PostRow = { id: string; slug: string; title: string; status: string; published_at: string | null; jlpt_level: string | string[] | null; og_image_url: string | null; summary: string | null };

export default async function AdminBlogsPage() {
  let posts: PostRow[] = [];
  let thisMonth = 0;
  let blogViews = 0;
  let blogAvgSeconds: number | null = null;

  if (sql) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const [postsRows, countRows, analyticsRows] = await Promise.all([
      sql`SELECT id, slug, title, status, published_at, jlpt_level, og_image_url, summary FROM posts ORDER BY created_at DESC`,
      sql`SELECT COUNT(*)::int AS c FROM posts WHERE published_at >= ${monthStart}`,
      sql`
        SELECT
          COUNT(*) FILTER (WHERE event_type = 'view') AS views,
          ROUND(AVG(duration_seconds) FILTER (WHERE event_type = 'duration'))::int AS avg_seconds
        FROM content_events
        WHERE content_type = 'blog'
      `,
    ]);
    posts = (postsRows ?? []) as PostRow[];
    thisMonth = (countRows[0] as { c: number })?.c ?? 0;
    if (Array.isArray(analyticsRows) && analyticsRows[0]) {
      const row = analyticsRows[0] as { views: number; avg_seconds: number | null };
      blogViews = Number(row.views || 0);
      blogAvgSeconds = row.avg_seconds;
    }
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
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <p className="text-sm text-secondary">
          <a href="/admin/ai-logs?entityType=post" className="text-primary hover:underline">
            AI history
          </a>{" "}
          (content &amp; image generations for posts)
        </p>
        <p className="text-sm text-secondary">
          <Link href="/admin/analytics" className="text-primary hover:underline">
            Content analytics
          </Link>
          {blogViews > 0 && (
            <>
              {" "}
              — {blogViews} views
              {blogAvgSeconds != null && blogAvgSeconds > 0 ? `, avg ${blogAvgSeconds}s per session` : ""}
            </>
          )}
        </p>
      </div>
      <BlogListClient
        posts={posts}
        stats={{ total, published, draft, thisMonth }}
      />
    </div>
  );
}
