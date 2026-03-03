import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { sendCommunityGuidelinesEmail } from "@/lib/email";
import {
  emailWrapper,
  communityGuidelinesContent,
  productListHtml,
  type EmailProduct,
} from "@/lib/email-templates";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const preview = searchParams.get("preview");
  if (preview !== "guidelines") {
    return NextResponse.json({ error: "Invalid preview type" }, { status: 400 });
  }

  try {
    const { id } = await params;
    if (!sql) return NextResponse.json({ error: "Failed" }, { status: 503 });

    const commentRows = await sql`SELECT id, author_name, author_email, post_id FROM post_comments WHERE id = ${id} LIMIT 1`;
    const comment = commentRows[0] as { id: string; author_name: string; author_email: string; post_id: string } | undefined;
    if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

    const postRows = await sql`SELECT slug, title FROM posts WHERE id = ${comment.post_id} LIMIT 1`;
    const post = postRows[0] as { slug: string; title: string } | undefined;
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";
    const postUrl = `${siteUrl.replace(/\/$/, "")}/blog/${post.slug}`;
    const content = communityGuidelinesContent(
      comment.author_name,
      post.title,
      postUrl
    );
    const productRows = await sql`SELECT slug, name, price_paise, image_url, jlpt_level FROM products ORDER BY sort_order ASC LIMIT 6`;
    const productList = productListHtml((productRows || []) as EmailProduct[], siteUrl);
    const html = emailWrapper(content, productList);

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e) {
    console.error("Comment preview:", e);
    return NextResponse.json({ error: "Failed to generate preview" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    if (!sql) return NextResponse.json({ error: "Failed" }, { status: 503 });
    await sql`UPDATE post_comments SET status = 'removed' WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Comment DELETE:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action !== "send_guidelines") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (!sql) return NextResponse.json({ error: "Failed" }, { status: 503 });

    const commentRows = await sql`SELECT id, author_name, author_email, post_id FROM post_comments WHERE id = ${id} LIMIT 1`;
    const comment = commentRows[0] as { author_name: string; author_email: string; post_id: string } | undefined;
    if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

    const postRows = await sql`SELECT slug, title FROM posts WHERE id = ${comment.post_id} LIMIT 1`;
    const post = postRows[0] as { slug: string; title: string } | undefined;
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";
    const postUrl = `${siteUrl.replace(/\/$/, "")}/blog/${post.slug}`;

    await sendCommunityGuidelinesEmail(
      comment.author_email,
      comment.author_name,
      post.title,
      postUrl
    );

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Comment POST:", e);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
