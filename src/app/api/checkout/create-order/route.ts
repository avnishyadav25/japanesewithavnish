import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { sql } from "@/lib/db";

/** Razorpay rejects payloads with emojis (400). Strip emoji/symbols for description. */
function stripForRazorpay(s: string): string {
  const noEmoji = s.replace(/[\uD83C-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF\uFE00-\uFE0F]/g, "").trim();
  return noEmoji || "Order";
}

export async function POST(req: Request) {
  try {
    const { productId, name, email, phone, couponCode } = await req.json();
    if (!productId || !name || !email || !phone) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    if (!sql) {
      return NextResponse.json({ error: "Checkout unavailable" }, { status: 503 });
    }

    const productRows = await sql`SELECT id, name, price_paise FROM products WHERE id = ${productId} LIMIT 1`;
    const product = productRows[0];
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    let amountPaise = Number(product.price_paise);
    let discountPaise = 0;
    let appliedCoupon: string | null = null;

    if (couponCode?.trim()) {
      const code = couponCode.toUpperCase().trim();
      const couponRows = await sql`
        SELECT id, discount_type, discount_value, product_ids, max_uses, used_count, expires_at
        FROM coupons WHERE code = ${code} LIMIT 1
      `;
      const coupon = couponRows[0];
      if (coupon) {
        const expired = coupon.expires_at && new Date(coupon.expires_at as string) < new Date();
        const limitReached =
          coupon.max_uses != null && Number(coupon.used_count ?? 0) >= Number(coupon.max_uses);
        const productIds = coupon.product_ids as string[] | null;
        const validProduct = !productIds || productIds.length === 0 || productIds.includes(productId);

        if (!expired && !limitReached && validProduct) {
          const discountValue = Number(coupon.discount_value);
          if (coupon.discount_type === "percent") {
            discountPaise = Math.round((amountPaise * discountValue) / 100);
          } else {
            discountPaise = Math.min(discountValue, amountPaise);
          }
          amountPaise = Math.max(0, amountPaise - discountPaise);
          appliedCoupon = code;
        }
      }
    }

    if (amountPaise < 100) {
      return NextResponse.json({ error: "Amount too low for payment (min ₹1)" }, { status: 400 });
    }

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const useRazorpay = Boolean(keyId && keySecret);

    const orderRows = await sql`
      INSERT INTO orders (user_email, user_name, user_phone, status, provider, total_amount_paise, coupon_code, discount_paise)
      VALUES (${email}, ${name}, ${phone}, 'pending_payment', ${useRazorpay ? "razorpay" : "manual"}, ${amountPaise}, ${appliedCoupon}, ${discountPaise})
      RETURNING id
    `;
    const order = orderRows[0];
    if (!order) {
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }
    const orderId = order.id as string;

    const finalPricePaise = Number(product.price_paise) - discountPaise;
    await sql`
      INSERT INTO order_items (order_id, product_id, quantity, price_paise)
      VALUES (${orderId}, ${productId}, 1, ${finalPricePaise})
    `;

    if (appliedCoupon) {
      await sql`UPDATE coupons SET used_count = COALESCE(used_count, 0) + 1 WHERE code = ${appliedCoupon}`;
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    if (!useRazorpay) {
      await sql`
        INSERT INTO payments (order_id, provider_payment_id, status)
        VALUES (${orderId}, ${orderId}, 'created')
      `;
      return NextResponse.json({
        orderId,
        paymentMethod: "manual",
        amountPaise,
        name: "Japanese with Avnish",
        description: String(product.name),
      });
    }

    const razorpay = new Razorpay({ key_id: keyId!, key_secret: keySecret! });
    const rzOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: orderId,
      notes: { order_id: orderId },
    });

    await sql`
      INSERT INTO payments (order_id, provider_payment_id, status)
      VALUES (${orderId}, ${rzOrder.id}, 'created')
    `;

    return NextResponse.json({
      orderId,
      razorpayOrderId: rzOrder.id,
      key: keyId,
      amount: amountPaise,
      name: "Japanese with Avnish",
      description: stripForRazorpay(String(product.name)),
      redirectUrl: `${siteUrl}/thank-you?order=${orderId}`,
    });
  } catch (e) {
    console.error("Create order:", e);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
