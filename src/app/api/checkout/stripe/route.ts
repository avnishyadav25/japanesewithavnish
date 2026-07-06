import { NextResponse } from "next/server";
import Stripe from "stripe";
import { sql } from "@/lib/db";

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "dummy_key", {
    apiVersion: "2023-10-16" as any,
  });
  try {
    const { planId, name, email, phone, couponCode } = await req.json();
    if (!planId || !name || !email || !phone) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    if (!sql) {
      return NextResponse.json({ error: "Checkout unavailable" }, { status: 503 });
    }

    // 1. Fetch Plan details from database (price_usd is in cents)
    const planRows = await sql`
      SELECT id, name, price_usd FROM subscription_plans
      WHERE id::text = ${planId} OR slug = ${planId} LIMIT 1
    ` as { id: string; name: string; price_usd: number }[];
    const plan = planRows[0];
    if (!plan) {
      return NextResponse.json({ error: "Subscription plan not found" }, { status: 404 });
    }

    let amountPaise = Number(plan.price_usd); // USD cents
    let discountPaise = 0;
    let appliedCoupon: string | null = null;

    // 2. Validate Coupons if present
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
                            productIds.includes(plan.id);

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

    // Minimum amount for Stripe is 50 cents (USD 0.50)
    if (amountPaise < 50) {
      return NextResponse.json({ error: "Amount too low for payment (min $0.50)" }, { status: 400 });
    }

    // 3. Create Pending Order record in DB
    const orderRows = await sql`
      INSERT INTO orders (user_email, user_name, user_phone, status, provider, total_amount_paise, coupon_code, discount_paise, plan_id)
      VALUES (${email}, ${name}, ${phone}, 'pending_payment', 'stripe', ${amountPaise}, ${appliedCoupon}, ${discountPaise}, ${plan.id})
      RETURNING id
    `;
    const order = orderRows[0];
    if (!order) {
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }
    const orderId = order.id as string;

    // 4. Create Stripe Checkout Session
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: plan.name,
              description: `Japanese with Avnish Premium Pass - ${plan.name}`,
            },
            unit_amount: amountPaise, // in cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      customer_email: email,
      metadata: {
        orderId: orderId,
      },
      success_url: `${siteUrl}/thank-you?order=${orderId}`,
      cancel_url: `${siteUrl}/pricing`,
    });

    if (appliedCoupon) {
      await sql`UPDATE coupons SET used_count = COALESCE(used_count, 0) + 1 WHERE code = ${appliedCoupon}`;
    }

    await sql`
      INSERT INTO payments (order_id, provider_payment_id, status)
      VALUES (${orderId}, ${session.id}, 'created')
    `;

    return NextResponse.json({ sessionUrl: session.url });
  } catch (error) {
    console.error("Stripe Checkout error:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
