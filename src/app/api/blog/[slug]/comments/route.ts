import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  sendWelcomeNewsletter,
  sendNewCommentNotification,
} from "@/lib/email";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!sql) return NextResponse.json({ error: "Failed to fetch comments" }, { status: 503 });
    const postRows = await sql`SELECT id FROM posts WHERE slug = ${slug} AND status = 'published' LIMIT 1`;
    const post = postRows[0] as { id: string } | undefined;
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    const commentsRows = await sql`
      SELECT id, author_name, author_email, content, created_at
      FROM post_comments WHERE post_id = ${post.id} AND status = 'approved'
      ORDER BY created_at ASC
    `;
    return NextResponse.json({ comments: commentsRows || [] });
  } catch (e) {
    console.error("Comments GET:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
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

    const postRows = await sql`SELECT id, title FROM posts WHERE slug = ${slug} AND status = 'published' LIMIT 1`;
    const post = postRows[0] as { id: string; title: string } | undefined;
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    const insertRows = await sql`
      INSERT INTO post_comments (post_id, author_name, author_email, content, status)
      VALUES (${post.id}, ${name.trim()}, ${trimmedEmail}, ${content.trim()}, 'approved')
      RETURNING id
    `;
    const comment = insertRows[0] as { id: string } | undefined;

    const existingSub = await sql`SELECT id FROM subscribers WHERE email = ${trimmedEmail} LIMIT 1`;
    const isNewSubscriber = existingSub.length === 0;

    await sql`
      INSERT INTO subscribers (email, name, source) VALUES (${trimmedEmail}, ${name.trim()}, 'blog_comment')
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, source = EXCLUDED.source
    `;

    if (isNewSubscriber) {
      sendWelcomeNewsletter(trimmedEmail, name.trim()).catch((err) =>
        console.error("Welcome email:", err)
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";
    const postUrl = `${siteUrl.replace(/\/$/, "")}/blog/${slug}`;
    const commentPreview = content.trim().replace(/\s+/g, " ").slice(0, 120);

    const previousCommenters = await sql`
      SELECT author_email, author_name FROM post_comments
      WHERE post_id = ${post.id} AND status = 'approved' AND author_email != ${trimmedEmail}
    ` as { author_email: string; author_name: string }[];

    const uniqueEmails = new Map<string, string>();
    for (const c of previousCommenters || []) {
      if (c.author_email && !uniqueEmails.has(c.author_email)) {
        uniqueEmails.set(c.author_email, c.author_name || "Reader");
      }
    }

    const notifyPromises = Array.from(uniqueEmails.entries()).map(([emailAddr, recipientName]) =>
      sendNewCommentNotification(
        emailAddr,
        recipientName,
        post.title,
        postUrl,
        name.trim(),
        commentPreview
      ).catch((err) => console.error("Comment notification:", err))
    );

    await Promise.allSettled(notifyPromises);

    return NextResponse.json({ success: true, id: comment?.id });
  } catch (e) {
    console.error("Comment POST:", e);
    return NextResponse.json({ error: "Failed to post comment" }, { status: 500 });
  }
}
