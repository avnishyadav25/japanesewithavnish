import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { createRazorpayClient, getRazorpayErrorStatus, getRazorpayKeyId, getRazorpayKeySecret } from "@/lib/razorpay";

/** Razorpay rejects payloads with emojis (400). Strip emoji/symbols for description. */
function stripForRazorpay(s: string): string {
  const noEmoji = s.replace(/[\uD83C-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF\uFE00-\uFE0F]/g, "").trim();
  return noEmoji || "Order";
}

export async function POST(req: Request) {
  try {
    const { productId, planId, name, email, phone, couponCode } = await req.json();
    if ((!productId && !planId) || !name || !email || !phone) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    if (!sql) {
      return NextResponse.json({ error: "Checkout unavailable" }, { status: 503 });
    }

    let amountPaise = 0;
    let displayName = "Premium Purchase";
    let dbPlanId: string | null = null;
    let dbProductId: string | null = null;

    if (planId) {
      const planRows = await sql`
        SELECT id, name, price_inr FROM subscription_plans
        WHERE id::text = ${planId} OR slug = ${planId} LIMIT 1
      ` as { id: string; name: string; price_inr: number }[];
      const plan = planRows[0];
      if (!plan) {
        return NextResponse.json({ error: "Subscription plan not found" }, { status: 404 });
      }
      amountPaise = Number(plan.price_inr);
      displayName = plan.name;
      dbPlanId = plan.id;
    } else if (productId) {
      const productRows = await sql`SELECT id, name, price_paise FROM products WHERE id = ${productId} LIMIT 1`;
      const product = productRows[0];
      if (!product) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }
      amountPaise = Number(product.price_paise);
      displayName = product.name;
      dbProductId = product.id;
    }

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
        const validItem = !productIds || productIds.length === 0 || 
                            (dbProductId && productIds.includes(dbProductId)) ||
                            (dbPlanId && productIds.includes(dbPlanId));

        if (!expired && !limitReached && validItem) {
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

    const keyId = getRazorpayKeyId();
    const keySecret = getRazorpayKeySecret();
    const useRazorpay = Boolean(keyId && keySecret);

    const orderRows = await sql`
      INSERT INTO orders (user_email, user_name, user_phone, status, provider, total_amount_paise, coupon_code, discount_paise, plan_id)
      VALUES (${email}, ${name}, ${phone}, 'pending_payment', ${useRazorpay ? "razorpay" : "manual"}, ${amountPaise}, ${appliedCoupon}, ${discountPaise}, ${dbPlanId})
      RETURNING id
    `;
    const order = orderRows[0];
    if (!order) {
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }
    const orderId = order.id as string;

    const finalPricePaise = amountPaise;
    await sql`
      INSERT INTO order_items (order_id, product_id, quantity, price_paise)
      VALUES (${orderId}, ${dbProductId}, 1, ${finalPricePaise})
    `;

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
        description: displayName,
      });
    }

    const { client: razorpay } = createRazorpayClient();
    const rzOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: orderId,
      notes: { order_id: orderId },
    });

    await sql`
      INSERT INTO payments (order_id, provider_order_id, status)
      VALUES (${orderId}, ${rzOrder.id}, 'created')
    `;

    return NextResponse.json({
      orderId,
      razorpayOrderId: rzOrder.id,
      key: keyId,
      amount: amountPaise,
      name: "Japanese with Avnish",
      description: stripForRazorpay(displayName),
      redirectUrl: `${siteUrl}/thank-you?order=${orderId}`,
    });
  } catch (e) {
    console.error("Create order:", e);
    if (getRazorpayErrorStatus(e) === 401) {
      return NextResponse.json({ error: "Razorpay authentication failed" }, { status: 401 });
    }
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
