import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { code, productId } = await req.json();
    if (!code || !productId) {
      return NextResponse.json({ error: "Code and productId required" }, { status: 400 });
    }

    if (!sql) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const codeUpper = code.toUpperCase().trim();
    const couponRows = await sql`
      SELECT id, discount_type, discount_value, product_ids, max_uses, used_count, expires_at
      FROM coupons WHERE code = ${codeUpper} LIMIT 1
    ` as { id: string; discount_type: string; discount_value: number; product_ids: string[] | null; max_uses: number | null; used_count: number; expires_at: string | null }[];
    const coupon = couponRows[0] ?? null;
    let pricePaise = 0;
    if (coupon) {
      const prodRows = await sql`SELECT price_paise FROM products WHERE id = ${productId} LIMIT 1` as { price_paise: number }[];
      pricePaise = Number(prodRows[0]?.price_paise ?? 0);
    }

    if (!coupon) {
      return NextResponse.json({ valid: false, error: "Invalid coupon" });
    }

    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return NextResponse.json({ valid: false, error: "Coupon expired" });
    }

    if (coupon.max_uses != null && (Number(coupon.used_count ?? 0) >= coupon.max_uses)) {
      return NextResponse.json({ valid: false, error: "Coupon limit reached" });
    }

    const productIds = coupon.product_ids;
    if (productIds && productIds.length > 0 && !productIds.includes(productId)) {
      return NextResponse.json({ valid: false, error: "Coupon not valid for this product" });
    }
    let discountPaise = 0;
    if (coupon.discount_type === "percent") {
      discountPaise = Math.round((pricePaise * coupon.discount_value) / 100);
    } else {
      discountPaise = Math.min(coupon.discount_value, pricePaise);
    }
    const finalPaise = Math.max(0, pricePaise - discountPaise);

    return NextResponse.json({
      valid: true,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      discount_paise: discountPaise,
      final_paise: finalPaise,
    });
  } catch (e) {
    console.error("Validate coupon:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
