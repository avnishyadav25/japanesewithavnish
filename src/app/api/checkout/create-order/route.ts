import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const { productId, name, email, phone, couponCode } = await req.json();
    if (!productId || !name || !email || !phone) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, name, price_paise")
      .eq("id", productId)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    let amountPaise = product.price_paise;
    let discountPaise = 0;
    let appliedCoupon: string | null = null;

    if (couponCode?.trim()) {
      const { data: coupon } = await supabase
        .from("coupons")
        .select("id, discount_type, discount_value, product_ids, max_uses, used_count, expires_at")
        .eq("code", couponCode.toUpperCase().trim())
        .single();

      if (coupon) {
        const expired = coupon.expires_at && new Date(coupon.expires_at) < new Date();
        const limitReached = coupon.max_uses != null && (coupon.used_count ?? 0) >= coupon.max_uses;
        const productIds = coupon.product_ids as string[] | null;
        const validProduct = !productIds || productIds.length === 0 || productIds.includes(productId);

        if (!expired && !limitReached && validProduct) {
          if (coupon.discount_type === "percent") {
            discountPaise = Math.round((amountPaise * coupon.discount_value) / 100);
          } else {
            discountPaise = Math.min(coupon.discount_value, amountPaise);
          }
          amountPaise = Math.max(0, amountPaise - discountPaise);
          appliedCoupon = couponCode.toUpperCase().trim();
        }
      }
    }
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_email: email,
        user_name: name,
        user_phone: phone,
        status: "pending_payment",
        provider: "razorpay",
        total_amount_paise: amountPaise,
        coupon_code: appliedCoupon,
        discount_paise: discountPaise,
      })
      .select("id")
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }

    await supabase.from("order_items").insert({
      order_id: order.id,
      product_id: productId,
      quantity: 1,
      price_paise: product.price_paise - discountPaise,
    });

    if (appliedCoupon) {
      const { data: c } = await supabase.from("coupons").select("used_count").eq("code", appliedCoupon).single();
      if (c) await supabase.from("coupons").update({ used_count: (c.used_count ?? 0) + 1 }).eq("code", appliedCoupon);
    }

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return NextResponse.json({ error: "Razorpay not configured" }, { status: 500 });
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const rzOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: order.id,
      notes: { order_id: order.id },
    });

    await supabase.from("payments").insert({
      order_id: order.id,
      provider_payment_id: rzOrder.id,
      status: "created",
    });

    return NextResponse.json({
      orderId: order.id,
      razorpayOrderId: rzOrder.id,
      key: keyId,
      amount: amountPaise,
      name: "Japanese with Avnish",
      description: product.name,
      redirectUrl: `${siteUrl}/thank-you?order=${order.id}`,
    });
  } catch (e) {
    console.error("Create order:", e);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
