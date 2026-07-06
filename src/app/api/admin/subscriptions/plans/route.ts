import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const plans = await sql`
      SELECT id, name, slug, billing_type, price_inr, price_usd, is_active, is_popular, sort_order
      FROM subscription_plans
      ORDER BY sort_order
    `;
    return NextResponse.json(plans);
  } catch (error) {
    console.error("Admin plans GET error:", error);
    return NextResponse.json({ error: "Failed to fetch plans" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const { id, price_inr, price_usd, is_active, is_popular } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Plan ID is required" }, { status: 400 });
    }

    await sql`
      UPDATE subscription_plans
      SET
        price_inr = COALESCE(${price_inr != null ? Number(price_inr) : null}, price_inr),
        price_usd = COALESCE(${price_usd != null ? Number(price_usd) : null}, price_usd),
        is_active = COALESCE(${is_active}, is_active),
        is_popular = COALESCE(${is_popular}, is_popular),
        updated_at = NOW()
      WHERE id::text = ${id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin plans PATCH error:", error);
    return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
  }
}
export const dynamic = "force-dynamic";
