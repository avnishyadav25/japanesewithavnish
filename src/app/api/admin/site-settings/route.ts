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
      // value column is JSONB — every write in this codebase goes through JSON.stringify()::jsonb
      // (see e.g. social-packs/[id]/route.ts); a plain JS string passed directly, unencoded, is
      // not valid JSON on its own (JSON strings must be quoted) and fails Postgres's jsonb
      // validation (22P02) for every plain-text setting — this was the actual cause of every
      // save silently failing.
      await sql`
        INSERT INTO site_settings (key, value, updated_at)
        VALUES (${key}, ${JSON.stringify(value ?? null)}::jsonb, ${updatedAt})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
      `;
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Site settings save:", e);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
