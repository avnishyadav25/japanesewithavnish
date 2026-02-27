import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendCommunityGuidelinesEmail } from "@/lib/email";
import {
  emailWrapper,
  communityGuidelinesContent,
  productListHtml,
  type EmailProduct,
} from "@/lib/email-templates";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    return null;
  }
  return user;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const preview = searchParams.get("preview");
  if (preview !== "guidelines") {
    return NextResponse.json({ error: "Invalid preview type" }, { status: 400 });
  }

  try {
    const { id } = await params;
    const admin = createAdminClient();
    const { data: comment, error: fetchError } = await admin
      .from("post_comments")
      .select("id, author_name, author_email, post_id")
      .eq("id", id)
      .single();

    if (fetchError || !comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const { data: post } = await admin
      .from("posts")
      .select("slug, title")
      .eq("id", comment.post_id)
      .single();

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";
    const postUrl = `${siteUrl.replace(/\/$/, "")}/blog/${post.slug}`;
    const content = communityGuidelinesContent(
      comment.author_name,
      post.title,
      postUrl
    );
    const { data: products } = await admin
      .from("products")
      .select("slug, name, price_paise, image_url, jlpt_level")
      .order("sort_order", { ascending: true })
      .limit(6);
    const productList = productListHtml((products || []) as EmailProduct[], siteUrl);
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
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const admin = createAdminClient();
    const { error } = await admin
      .from("post_comments")
      .update({ status: "removed" })
      .eq("id", id);

    if (error) {
      console.error("Comment remove:", error);
      return NextResponse.json({ error: "Failed to remove comment" }, { status: 500 });
    }
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
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action !== "send_guidelines") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: comment, error: fetchError } = await admin
      .from("post_comments")
      .select("id, author_name, author_email, post_id")
      .eq("id", id)
      .single();

    if (fetchError || !comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    const { data: post } = await admin
      .from("posts")
      .select("slug, title")
      .eq("id", comment.post_id)
      .single();

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

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
