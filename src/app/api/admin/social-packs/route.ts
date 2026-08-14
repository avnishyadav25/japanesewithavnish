import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ packs: [] });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id")?.trim();
  const entityType = searchParams.get("entity_type")?.trim();
  const slug = searchParams.get("slug")?.trim();

  if (id) {
    const rows = await sql`
      SELECT id, entity_type, entity_id, slug, title, description, summary, link, reference_image_url, payload, image_urls, created_at, updated_at
      FROM social_content_packs WHERE id = ${id} LIMIT 1
    ` as { id: string; entity_type: string; entity_id: string | null; slug: string; title: string; description: string | null; summary: string | null; link: string | null; reference_image_url: string | null; payload: Record<string, unknown>; image_urls: Record<string, string> | null; created_at: string; updated_at: string }[];
    const pack = rows[0];
    if (!pack) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ pack });
  }

  if (entityType && slug) {
    const rows = await sql`
      SELECT id, entity_type, entity_id, slug, title, description, summary, link, reference_image_url, payload, image_urls, created_at, updated_at
      FROM social_content_packs
      WHERE entity_type = ${entityType} AND slug = ${slug}
      ORDER BY created_at DESC
      LIMIT 1
    ` as { id: string; entity_type: string; entity_id: string | null; slug: string; title: string; description: string | null; summary: string | null; link: string | null; reference_image_url: string | null; payload: Record<string, unknown>; image_urls: Record<string, string> | null; created_at: string; updated_at: string }[];
    const pack = rows[0];
    if (!pack) return NextResponse.json({ error: "No pack found for this type and slug" }, { status: 404 });
    return NextResponse.json({ pack });
  }

  const rows = await sql`
    SELECT id, entity_type, entity_id, slug, title, image_urls, created_at
    FROM social_content_packs
    ORDER BY created_at DESC
    LIMIT 50
  ` as { id: string; entity_type: string; entity_id: string | null; slug: string; title: string; image_urls: Record<string, string> | null; created_at: string }[];

  return NextResponse.json({ packs: rows || [] });
}
