import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { LEARN_CONTENT_TYPES, type LearnContentType } from "@/lib/learn-filters";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ type: string; slug: string }> }
) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { type, slug: oldSlug } = await params;
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
    const contentVal = content !== undefined && content !== null ? String(content) : null;

    try {
      await sql`
        UPDATE learning_content SET
          slug = ${String(slug).trim()},
          title = ${String(title).trim()},
          content = ${contentVal},
          jlpt_level = ${jlpt_level || null},
          tags = ${Array.isArray(tags) ? tags : []},
          meta = ${metaVal}::jsonb,
          status = ${statusVal},
          sort_order = ${sortOrderVal},
          updated_at = ${new Date().toISOString()}
        WHERE content_type = ${type} AND slug = ${oldSlug}
      `;
      return NextResponse.json({ success: true });
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e?.code === "23505") return NextResponse.json({ error: "Slug already exists" }, { status: 400 });
      throw err;
    }
  } catch (e) {
    console.error("Learning content update:", e);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ type: string; slug: string }> }
) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { type, slug } = await params;
    if (!LEARN_CONTENT_TYPES.includes(type as LearnContentType)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

    const result = await sql`
      DELETE FROM learning_content
      WHERE content_type = ${type} AND slug = ${slug}
      RETURNING id
    `;
    if (!result?.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Learning content delete:", e);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
