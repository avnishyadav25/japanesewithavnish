import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const sections = await sql`
      SELECT id, title, slug, short_description, body, icon, feature_image_url, link_href, link_label, sort_order, published
      FROM platform_guide_sections
      ORDER BY sort_order, created_at
    `;
    return NextResponse.json(sections);
  } catch (error) {
    console.error("Admin guide-sections GET error:", error);
    return NextResponse.json({ error: "Failed to fetch guide sections" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const { title, slug, short_description, body, icon, feature_image_url, link_href, link_label, sort_order, published } = await req.json();
    if (!title || !short_description) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const finalSlug = (slug || title)
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");

    const rows = await sql`
      INSERT INTO platform_guide_sections (title, slug, short_description, body, icon, feature_image_url, link_href, link_label, sort_order, published, created_at, updated_at)
      VALUES (
        ${title},
        ${finalSlug},
        ${short_description},
        ${body || null},
        ${icon || null},
        ${feature_image_url || null},
        ${link_href || null},
        ${link_label || null},
        ${sort_order != null ? Number(sort_order) : 0},
        ${published !== false},
        NOW(),
        NOW()
      )
      RETURNING id
    `;

    return NextResponse.json({ success: true, id: (rows as { id: string }[])[0]?.id });
  } catch (error) {
    console.error("Admin guide-sections POST error:", error);
    const message = error instanceof Error && error.message.includes("idx_platform_guide_sections_slug")
      ? "A section with this slug already exists"
      : "Failed to create guide section";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
