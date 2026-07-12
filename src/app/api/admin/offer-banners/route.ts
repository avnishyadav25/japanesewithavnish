import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const banners = await sql`
      SELECT id, title, message, link_url, image_url, active, start_at::text, end_at::text, priority
      FROM offer_banners
      ORDER BY priority DESC, created_at DESC
    `;
    return NextResponse.json(banners);
  } catch (error) {
    console.error("Admin offer-banners GET error:", error);
    return NextResponse.json({ error: "Failed to fetch banners" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const { title, message, link_url, image_url, active, start_at, end_at, priority } = await req.json();
    if (!title || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await sql`
      INSERT INTO offer_banners (title, message, link_url, image_url, active, start_at, end_at, priority, created_at, updated_at)
      VALUES (
        ${title},
        ${message},
        ${link_url || null},
        ${image_url || null},
        ${active !== false},
        ${start_at ? new Date(start_at).toISOString() : null},
        ${end_at ? new Date(end_at).toISOString() : null},
        ${priority != null ? Number(priority) : 0},
        NOW(),
        NOW()
      )
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin offer-banners POST error:", error);
    return NextResponse.json({ error: "Failed to create banner" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing banner ID" }, { status: 400 });

    await sql`DELETE FROM offer_banners WHERE id::text = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin offer-banners DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete banner" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
