import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { LEARN_CONTENT_TYPES, type LearnContentType } from "@/lib/learn-filters";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { type } = await params;
    if (!LEARN_CONTENT_TYPES.includes(type as LearnContentType)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const body = await req.json();
    const { slug, title, content, jlpt_level, tags, status, sort_order, meta } = body;

    if (!slug || !title) {
      return NextResponse.json({ error: "slug and title required" }, { status: 400 });
    }

    if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

    const statusVal = status === "published" ? "published" : "draft";
    const sortOrderVal = typeof sort_order === "number" ? sort_order : 0;
    const metaVal =
      meta != null && typeof meta === "object" && !Array.isArray(meta)
        ? JSON.stringify(meta)
        : "{}";
    const summaryVal = meta != null && typeof meta === "object" && !Array.isArray(meta) && typeof (meta as Record<string, unknown>).summary === "string"
      ? (meta as Record<string, unknown>).summary as string
      : null;
    const ogImageVal = meta != null && typeof meta === "object" && !Array.isArray(meta) && typeof (meta as Record<string, unknown>).feature_image_url === "string"
      ? (meta as Record<string, unknown>).feature_image_url as string
      : null;
    const imagePromptVal = meta != null && typeof meta === "object" && !Array.isArray(meta) && typeof (meta as Record<string, unknown>).image_prompt === "string"
      ? (meta as Record<string, unknown>).image_prompt as string
      : null;
    const jlptArr = jlpt_level != null && String(jlpt_level).trim() ? [String(jlpt_level).trim()] : [];
    const publishedAtVal = statusVal === "published" ? new Date().toISOString() : null;

    try {
      const rows = await sql`
        INSERT INTO posts (content_type, slug, title, content, summary, jlpt_level, tags, og_image_url, image_prompt, status, published_at, sort_order, meta)
        VALUES (${type}, ${String(slug).trim()}, ${String(title).trim()}, ${content ?? null}, ${summaryVal}, ${jlptArr}, ${Array.isArray(tags) ? tags : []}, ${ogImageVal}, ${imagePromptVal}, ${statusVal}, ${publishedAtVal}, ${sortOrderVal}, ${metaVal}::jsonb)
        RETURNING id
      `;
      const id = (rows[0] as { id: string })?.id;
      return NextResponse.json({ id, slug: String(slug).trim() });
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e?.code === "23505") return NextResponse.json({ error: "Slug already exists" }, { status: 400 });
      throw err;
    }
  } catch (e) {
    console.error("Learning content create:", e);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
