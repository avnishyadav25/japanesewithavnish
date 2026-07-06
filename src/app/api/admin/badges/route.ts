import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const rows = await sql`
      SELECT id, name, slug, description, emoji, color, icon_type, icon_url, category, trigger_type, condition::text, is_active, created_at::text
      FROM badges
      ORDER BY created_at DESC
    `;
    return NextResponse.json(rows);
  } catch (e) {
    console.error("Admin badges GET error:", e);
    return NextResponse.json({ error: "Failed to fetch badges" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const { name, slug, description, emoji, color, icon_type, icon_url, category, trigger_type } = await req.json();

    if (!name || !slug || !description) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-_]/g, "-").trim();

    await sql`
      INSERT INTO badges (name, slug, description, emoji, color, icon_type, icon_url, category, trigger_type, created_at)
      VALUES (
        ${name.trim()},
        ${cleanSlug},
        ${description.trim()},
        ${emoji ? emoji.trim() : null},
        ${color ? color.trim() : "#D0021B"},
        ${icon_type || "emoji"},
        ${icon_url ? icon_url.trim() : null},
        ${category || "special"},
        ${trigger_type || "manual_special"},
        NOW()
      )
    `;

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Admin badges POST error:", e);
    return NextResponse.json({ error: "Failed to create badge" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const { id, name, slug, description, emoji, color, is_active, category, trigger_type } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Missing badge ID" }, { status: 400 });
    }

    const cleanSlug = slug ? slug.toLowerCase().replace(/[^a-z0-9-_]/g, "-").trim() : undefined;

    const rows = await sql`SELECT name, slug, description, emoji, color, is_active, category, trigger_type FROM badges WHERE id::text = ${id} LIMIT 1` as Record<string, unknown>[];
    const current = rows?.[0];
    if (!current) return NextResponse.json({ error: "Badge not found" }, { status: 404 });

    const n = name !== undefined ? name.trim() : current.name;
    const sl = cleanSlug !== undefined ? cleanSlug : current.slug;
    const desc = description !== undefined ? description.trim() : current.description;
    const em = emoji !== undefined ? emoji : current.emoji;
    const col = color !== undefined ? color : current.color;
    const active = is_active !== undefined ? is_active : current.is_active;
    const cat = category !== undefined ? category : current.category;
    const trig = trigger_type !== undefined ? trigger_type : current.trigger_type;

    await sql`
      UPDATE badges SET
        name = ${n},
        slug = ${sl},
        description = ${desc},
        emoji = ${em},
        color = ${col},
        is_active = ${active},
        category = ${cat},
        trigger_type = ${trig}
      WHERE id::text = ${id}
    `;

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Admin badges PATCH error:", e);
    return NextResponse.json({ error: "Failed to update badge" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing badge ID" }, { status: 400 });
    }

    await sql`DELETE FROM badges WHERE id::text = ${id}`;
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Admin badges DELETE error:", e);
    return NextResponse.json({ error: "Failed to delete badge" }, { status: 500 });
  }
}
export const dynamic = "force-dynamic";
