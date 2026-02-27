import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug: oldSlug } = await params;
    const body = await req.json();
    const {
      slug,
      title,
      summary,
      content,
      jlpt_level,
      tags,
      status,
      published_at,
      seo_title,
      seo_description,
      og_image_url,
      image_prompt,
    } = body;

    if (!slug || !title) {
      return NextResponse.json({ error: "slug and title required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("posts")
      .update({
        slug: String(slug).trim(),
        title: String(title).trim(),
        summary: summary ?? null,
        content: content ?? null,
        jlpt_level: Array.isArray(jlpt_level) ? jlpt_level : [],
        tags: Array.isArray(tags) ? tags : [],
        status: status === "published" ? "published" : "draft",
        published_at: status === "published" && published_at ? published_at : null,
        seo_title: seo_title ?? null,
        seo_description: seo_description ?? null,
        og_image_url: og_image_url || null,
        image_prompt: image_prompt ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("slug", oldSlug);

    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "Slug already exists" }, { status: 400 });
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Post update:", e);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
