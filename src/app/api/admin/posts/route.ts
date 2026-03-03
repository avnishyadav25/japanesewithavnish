import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

    const slugVal = String(slug).trim();
    const titleVal = String(title).trim();
    const statusVal = status === "published" ? "published" : "draft";
    const publishedAtVal = statusVal === "published" ? new Date().toISOString() : null;

    try {
      const rows = await sql`
        INSERT INTO posts (slug, title, summary, content, jlpt_level, tags, status, published_at, seo_title, seo_description, og_image_url, image_prompt)
        VALUES (${slugVal}, ${titleVal}, ${summary ?? null}, ${content ?? null}, ${Array.isArray(jlpt_level) ? jlpt_level : []}, ${Array.isArray(tags) ? tags : []}, ${statusVal}, ${publishedAtVal}, ${seo_title ?? null}, ${seo_description ?? null}, ${og_image_url || null}, ${image_prompt ?? null})
        RETURNING id
      `;
      const id = (rows[0] as { id: string })?.id;
      return NextResponse.json({ id, slug: slugVal });
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e?.code === "23505") return NextResponse.json({ error: "Slug already exists" }, { status: 400 });
      throw err;
    }
  } catch (e) {
    console.error("Post create:", e);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
