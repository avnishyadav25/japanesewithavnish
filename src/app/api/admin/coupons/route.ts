import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const coupons = await sql`
      SELECT id, code, discount_type, discount_value, product_ids, max_uses, used_count, expires_at::text
      FROM coupons
      ORDER BY created_at DESC
    `;
    return NextResponse.json(coupons);
  } catch (error) {
    console.error("Admin coupons GET error:", error);
    return NextResponse.json({ error: "Failed to fetch coupons" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const { code, discount_type, discount_value, product_ids, max_uses, expires_at } = await req.json();

    if (!code || !discount_type || discount_value == null) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const cleanCode = code.toUpperCase().trim();
    const cleanProductIds = Array.isArray(product_ids) ? product_ids.filter(Boolean) : [];

    await sql`
      INSERT INTO coupons (code, discount_type, discount_value, product_ids, max_uses, expires_at, created_at, updated_at)
      VALUES (
        ${cleanCode},
        ${discount_type},
        ${Number(discount_value)},
        ${cleanProductIds}::text[],
        ${max_uses != null ? Number(max_uses) : null},
        ${expires_at ? new Date(expires_at).toISOString() : null},
        NOW(),
        NOW()
      )
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin coupons POST error:", error);
    return NextResponse.json({ error: "Failed to create coupon" }, { status: 500 });
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
      return NextResponse.json({ error: "Missing coupon ID" }, { status: 400 });
    }

    await sql`DELETE FROM coupons WHERE id::text = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin coupons DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete coupon" }, { status: 500 });
  }
}
export const dynamic = "force-dynamic";
