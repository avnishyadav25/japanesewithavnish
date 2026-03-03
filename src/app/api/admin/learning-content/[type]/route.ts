import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

const TYPES = ["grammar", "vocabulary", "kanji", "reading", "writing"];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { type } = await params;
    if (!TYPES.includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const body = await req.json();
    const { slug, title, content, jlpt_level, tags, status, sort_order } = body;

    if (!slug || !title) {
      return NextResponse.json({ error: "slug and title required" }, { status: 400 });
    }

    if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

    const statusVal = status === "published" ? "published" : "draft";
    const sortOrderVal = typeof sort_order === "number" ? sort_order : 0;

    try {
      const rows = await sql`
        INSERT INTO learning_content (content_type, slug, title, content, jlpt_level, tags, status, sort_order)
        VALUES (${type}, ${String(slug).trim()}, ${String(title).trim()}, ${content ?? null}, ${jlpt_level || null}, ${Array.isArray(tags) ? tags : []}, ${statusVal}, ${sortOrderVal})
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
