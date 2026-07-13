import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const { id } = await params;
    const body = await req.json();

    const existing = (await sql`
      SELECT title, short_description, body, icon, link_href, link_label, sort_order, published
      FROM platform_guide_sections WHERE id::text = ${id} LIMIT 1
    `) as {
      title: string; short_description: string; body: string | null; icon: string | null;
      link_href: string | null; link_label: string | null; sort_order: number; published: boolean;
    }[];
    if (!existing.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const cur = existing[0];

    const title = typeof body.title === "string" ? body.title.trim() : cur.title;
    const shortDescription = typeof body.short_description === "string" ? body.short_description.trim() : cur.short_description;
    const bodyText = body.body !== undefined ? (body.body?.trim() || null) : cur.body;
    const icon = body.icon !== undefined ? (body.icon?.trim() || null) : cur.icon;
    const linkHref = body.link_href !== undefined ? (body.link_href?.trim() || null) : cur.link_href;
    const linkLabel = body.link_label !== undefined ? (body.link_label?.trim() || null) : cur.link_label;
    const sortOrder = typeof body.sort_order === "number" ? body.sort_order : cur.sort_order;
    const published = typeof body.published === "boolean" ? body.published : cur.published;

    const rows = await sql`
      UPDATE platform_guide_sections SET
        title = ${title},
        short_description = ${shortDescription},
        body = ${bodyText},
        icon = ${icon},
        link_href = ${linkHref},
        link_label = ${linkLabel},
        sort_order = ${sortOrder},
        published = ${published},
        updated_at = NOW()
      WHERE id::text = ${id}
      RETURNING id, title, short_description, body, icon, link_href, link_label, sort_order, published
    `;
    return NextResponse.json((rows as unknown[])[0]);
  } catch (error) {
    console.error("Admin guide-sections PATCH error:", error);
    return NextResponse.json({ error: "Failed to update guide section" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const { id } = await params;
    await sql`DELETE FROM platform_guide_sections WHERE id::text = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin guide-sections DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete guide section" }, { status: 500 });
  }
}
