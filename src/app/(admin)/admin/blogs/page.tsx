import { sql } from "@/lib/db";
import { AdminBlogsPageClient } from "./AdminBlogsPageClient";

type PostRow = { id: string; slug: string; title: string; status: string; published_at: string | null; jlpt_level: string | string[] | null; og_image_url: string | null; summary: string | null; content_type: string | null; created_at: string; updated_at: string };

export default async function AdminBlogsPage() {
  let posts: PostRow[] = [];
  let blogViews = 0;
  let blogAvgSeconds: number | null = null;

  if (sql) {
    const [postsRows, analyticsRows] = await Promise.all([
      sql`SELECT id, slug, title, status, published_at, jlpt_level, og_image_url, summary, content_type, created_at, updated_at FROM posts ORDER BY created_at DESC`,
      sql`
        SELECT
          COUNT(*) FILTER (WHERE event_type = 'view') AS views,
          ROUND(AVG(duration_seconds) FILTER (WHERE event_type = 'duration'))::int AS avg_seconds
        FROM content_events
        WHERE content_type = 'blog'
      `,
    ]);
    posts = (postsRows ?? []) as PostRow[];
    if (Array.isArray(analyticsRows) && analyticsRows[0]) {
      const row = analyticsRows[0] as { views: number; avg_seconds: number | null };
      blogViews = Number(row.views || 0);
      blogAvgSeconds = row.avg_seconds;
    }
  }

  return (
    <AdminBlogsPageClient
      posts={posts}
      blogViews={blogViews}
      blogAvgSeconds={blogAvgSeconds}
    />
  );
}
