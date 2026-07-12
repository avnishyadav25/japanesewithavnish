import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const codes = await sql`
      SELECT id, code, trial_days, max_uses, uses_count, expires_at::text, active
      FROM trial_codes
      ORDER BY created_at DESC
    `;
    return NextResponse.json(codes);
  } catch (error) {
    console.error("Admin trial-codes GET error:", error);
    return NextResponse.json({ error: "Failed to fetch trial codes" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const { code, trial_days, max_uses, expires_at } = await req.json();
    if (!code || !trial_days) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const cleanCode = code.toUpperCase().trim();

    await sql`
      INSERT INTO trial_codes (code, trial_days, max_uses, expires_at, created_at, updated_at)
      VALUES (
        ${cleanCode},
        ${Number(trial_days)},
        ${max_uses != null && max_uses !== "" ? Number(max_uses) : null},
        ${expires_at ? new Date(expires_at).toISOString() : null},
        NOW(),
        NOW()
      )
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin trial-codes POST error:", error);
    return NextResponse.json({ error: "Failed to create trial code" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing trial code ID" }, { status: 400 });

    await sql`DELETE FROM trial_codes WHERE id::text = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin trial-codes DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete trial code" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
