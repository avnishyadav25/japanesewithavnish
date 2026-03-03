import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
      seo_title,
      seo_description,
      og_image_url,
      image_prompt,
    } = body;

    if (!slug || !title) {
      return NextResponse.json({ error: "slug and title required" }, { status: 400 });
    }

    if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

    const statusVal = status === "published" ? "published" : "draft";
    const publishedAtVal = statusVal === "published" ? new Date().toISOString() : null;

    try {
      await sql`
        UPDATE posts SET
          slug = ${String(slug).trim()},
          title = ${String(title).trim()},
          summary = ${summary ?? null},
          content = ${content ?? null},
          jlpt_level = ${Array.isArray(jlpt_level) ? jlpt_level : []},
          tags = ${Array.isArray(tags) ? tags : []},
          status = ${statusVal},
          published_at = ${publishedAtVal},
          seo_title = ${seo_title ?? null},
          seo_description = ${seo_description ?? null},
          og_image_url = ${og_image_url || null},
          image_prompt = ${image_prompt ?? null},
          updated_at = ${new Date().toISOString()}
        WHERE slug = ${oldSlug}
      `;
      return NextResponse.json({ success: true });
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e?.code === "23505") return NextResponse.json({ error: "Slug already exists" }, { status: 400 });
      throw err;
    }
  } catch (e) {
    console.error("Post update:", e);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
