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
    const activeVal = typeof body.active === "boolean" ? body.active : null;

    const rows = await sql`
      UPDATE offer_banners SET
        active = COALESCE(${activeVal}, active),
        updated_at = NOW()
      WHERE id::text = ${id}
      RETURNING id, title, active
    `;
    if (!(rows as unknown[])?.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json((rows as unknown[])[0]);
  } catch (error) {
    console.error("Admin offer-banners PATCH error:", error);
    return NextResponse.json({ error: "Failed to update banner" }, { status: 500 });
  }
}
