import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { code, productId } = await req.json();
    if (!code || !productId) {
      return NextResponse.json({ error: "Code and productId required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: coupon, error } = await supabase
      .from("coupons")
      .select("id, code, discount_type, discount_value, product_ids, max_uses, used_count, expires_at")
      .eq("code", code.toUpperCase().trim())
      .single();

    if (error || !coupon) {
      return NextResponse.json({ valid: false, error: "Invalid coupon" });
    }

    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return NextResponse.json({ valid: false, error: "Coupon expired" });
    }

    if (coupon.max_uses != null && (coupon.used_count ?? 0) >= coupon.max_uses) {
      return NextResponse.json({ valid: false, error: "Coupon limit reached" });
    }

    const productIds = coupon.product_ids as string[] | null;
    if (productIds && productIds.length > 0 && !productIds.includes(productId)) {
      return NextResponse.json({ valid: false, error: "Coupon not valid for this product" });
    }

    const { data: prod } = await supabase.from("products").select("price_paise").eq("id", productId).single();
    const pricePaise = prod?.price_paise ?? 0;
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
