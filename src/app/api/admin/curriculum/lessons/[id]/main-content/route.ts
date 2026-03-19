import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id: lessonId } = await params;

  const linkRows = (await sql`
    SELECT c.content_slug, c.post_id
    FROM curriculum_lesson_content c
    WHERE c.lesson_id = ${lessonId} AND c.content_role = 'main'
    ORDER BY c.sort_order, c.content_slug
    LIMIT 1
  `) as { content_slug: string; post_id: string | null }[];
  const link = linkRows[0];
  if (!link) return NextResponse.json({ content: null, content_slug: null, post_id: null, title: null });

  const postRows = (await sql`
    SELECT id, slug, title, content, jlpt_level, tags, status, meta
    FROM posts
    WHERE (id = ${link.post_id} OR (slug = ${link.content_slug} AND content_type = 'study_guide'))
    LIMIT 1
  `) as { id: string; slug: string; title: string; content: string | null; jlpt_level: string[] | null; tags: string[] | null; status: string; meta: Record<string, unknown> | null }[];
  const post = postRows[0];
  if (!post)
    return NextResponse.json({
      content: null,
      content_slug: link.content_slug,
      post_id: link.post_id,
      title: null,
    });

  return NextResponse.json({
    content: post.content ?? "",
    content_slug: post.slug,
    post_id: post.id,
    title: post.title,
    jlpt_level: post.jlpt_level,
    tags: post.tags,
    status: post.status,
    meta: post.meta,
  });
}
