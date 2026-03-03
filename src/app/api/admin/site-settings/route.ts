import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

    const updatedAt = new Date().toISOString();
    for (const [key, value] of Object.entries(body)) {
      await sql`
        INSERT INTO site_settings (key, value, updated_at)
        VALUES (${key}, ${value ?? null}, ${updatedAt})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
      `;
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Site settings save:", e);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
