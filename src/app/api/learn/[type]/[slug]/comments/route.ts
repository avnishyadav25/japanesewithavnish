import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { LEARN_CONTENT_TYPES, type LearnContentType } from "@/lib/learn-filters";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string; slug: string }> }
) {
  try {
    const { type, slug } = await params;
    const normalized = (type || "").toLowerCase();
    if (!LEARN_CONTENT_TYPES.includes(normalized as LearnContentType)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!sql) return NextResponse.json({ error: "Failed to fetch comments" }, { status: 503 });
    const contentRows = await sql`
      SELECT id FROM posts
      WHERE content_type = ${normalized} AND slug = ${slug} AND status = 'published'
      LIMIT 1
    `;
    const content = contentRows[0] as { id: string } | undefined;
    if (!content) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    const commentsRows = await sql`
      SELECT id, author_name, author_email, content, created_at
      FROM post_comments
      WHERE post_id = ${content.id} AND status IN ('approved', 'approve')
      ORDER BY created_at ASC
    `;
    return NextResponse.json({ comments: commentsRows || [] });
  } catch (e) {
    console.error("Learn comments GET:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ type: string; slug: string }> }
) {
  try {
    const { type, slug } = await params;
    const normalized = (type || "").toLowerCase();
    if (!LEARN_CONTENT_TYPES.includes(normalized as LearnContentType)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const body = await req.json();
    const { name, email, content } = body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!email || typeof email !== "string" || !email.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    const trimmedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    if (!content || typeof content !== "string" || content.trim().length < 10) {
      return NextResponse.json({ error: "Comment must be at least 10 characters" }, { status: 400 });
    }
    if (!sql) return NextResponse.json({ error: "Failed to post comment" }, { status: 503 });
    const contentRows = await sql`
      SELECT id FROM posts
      WHERE content_type = ${normalized} AND slug = ${slug} AND status = 'published'
      LIMIT 1
    `;
    const lesson = contentRows[0] as { id: string } | undefined;
    if (!lesson) return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    const insertRows = await sql`
      INSERT INTO post_comments (post_id, author_name, author_email, content, status)
      VALUES (${lesson.id}, ${name.trim()}, ${trimmedEmail}, ${content.trim()}, 'approved')
      RETURNING id
    `;
    const comment = insertRows[0] as { id: string } | undefined;
    return NextResponse.json({ success: true, id: comment?.id });
  } catch (e) {
    console.error("Learn comment POST:", e);
    return NextResponse.json({ error: "Failed to post comment" }, { status: 500 });
  }
}
