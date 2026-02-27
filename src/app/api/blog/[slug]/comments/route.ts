import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendWelcomeNewsletter,
  sendNewCommentNotification,
} from "@/lib/email";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const supabase = createAdminClient();

    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("id")
      .eq("slug", slug)
      .eq("status", "published")
      .single();

    if (postError || !post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const { data: comments, error } = await supabase
      .from("post_comments")
      .select("id, author_name, author_email, content, created_at")
      .eq("post_id", post.id)
      .eq("status", "approved")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Comments fetch:", error);
      return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
    }

    return NextResponse.json({ comments: comments || [] });
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

    const supabase = createAdminClient();

    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("id, title")
      .eq("slug", slug)
      .eq("status", "published")
      .single();

    if (postError || !post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const { data: comment, error: insertError } = await supabase
      .from("post_comments")
      .insert({
        post_id: post.id,
        author_name: name.trim(),
        author_email: trimmedEmail,
        content: content.trim(),
        status: "approved",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Comment insert:", insertError);
      return NextResponse.json({ error: "Failed to post comment" }, { status: 500 });
    }

    const { data: existingSub } = await supabase
      .from("subscribers")
      .select("id")
      .eq("email", trimmedEmail)
      .single();

    const isNewSubscriber = !existingSub;

    await supabase.from("subscribers").upsert(
      {
        email: trimmedEmail,
        name: name.trim(),
        source: "blog_comment",
      },
      { onConflict: "email" }
    );

    if (isNewSubscriber) {
      sendWelcomeNewsletter(trimmedEmail, name.trim()).catch((err) =>
        console.error("Welcome email:", err)
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";
    const postUrl = `${siteUrl.replace(/\/$/, "")}/blog/${slug}`;
    const commentPreview = content.trim().replace(/\s+/g, " ").slice(0, 120);

    const { data: previousCommenters } = await supabase
      .from("post_comments")
      .select("author_email, author_name")
      .eq("post_id", post.id)
      .eq("status", "approved")
      .neq("author_email", trimmedEmail);

    const uniqueEmails = new Map<string, string>();
    for (const c of previousCommenters || []) {
      if (c.author_email && !uniqueEmails.has(c.author_email)) {
        uniqueEmails.set(c.author_email, c.author_name || "Reader");
      }
    }

    const notifyPromises = Array.from(uniqueEmails.entries()).map(([email, recipientName]) =>
      sendNewCommentNotification(
        email,
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
