import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession, createResetToken } from "@/lib/auth/session";
import { createRazorpayClient, getRazorpayErrorStatus, getRazorpayKeyId, getRazorpayKeySecret } from "@/lib/razorpay";
import { fulfillOrder } from "@/lib/order-fulfillment";
import { sendCreatePasswordEmail } from "@/lib/email";

/** Razorpay rejects payloads with emojis (400). Strip emoji/symbols for description. */
function stripForRazorpay(s: string): string {
  const noEmoji = s.replace(/[\uD83C-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF\uFE00-\uFE0F]/g, "").trim();
  return noEmoji || "Order";
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.email) {
      return NextResponse.json({ error: "Please log in before checkout", loginRequired: true }, { status: 401 });
    }

    const { productId, planId, name, email, phone, couponCode, currency: requestedCurrency } = await req.json();
    const orderCurrency = String(requestedCurrency || "INR").toUpperCase() === "USD" ? "USD" : "INR";
    if (productId) {
      return NextResponse.json({ error: "Store purchases are currently unavailable. Please choose a Premium Pass instead." }, { status: 403 });
    }
    if (!planId || !name || !email || !phone) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    if (String(email).toLowerCase() !== session.email.toLowerCase()) {
      return NextResponse.json({ error: "Checkout email must match your logged-in account" }, { status: 400 });
    }

    if (!sql) {
      return NextResponse.json({ error: "Checkout unavailable" }, { status: 503 });
    }

    let amountPaise = 0;
    let displayName = "Premium Purchase";
    let dbPlanId: string | null = null;
    const dbProductId: string | null = null;

    const planRows = await sql`
      SELECT id, name, price_inr, price_usd FROM subscription_plans
      WHERE id::text = ${planId} OR slug = ${planId} LIMIT 1
    ` as { id: string; name: string; price_inr: number; price_usd: number }[];
    const plan = planRows[0];
    if (!plan) {
      return NextResponse.json({ error: "Subscription plan not found" }, { status: 404 });
    }
    amountPaise = orderCurrency === "USD" ? Number(plan.price_usd) : Number(plan.price_inr);
    displayName = plan.name;
    dbPlanId = plan.id;

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

    // A coupon can discount the order to below Razorpay's minimum chargeable amount
    // (₹1 / $1). Rather than erroring, treat this as a fully free order: skip Razorpay
    // entirely and grant access directly.
    const isFreeOrder = amountPaise < 100;

    const keyId = getRazorpayKeyId();
    const keySecret = getRazorpayKeySecret();
    const useRazorpay = Boolean(keyId && keySecret) && !isFreeOrder;

    // "manual" (not "razorpay") for free orders too — user_subscriptions_provider_check
    // only allows razorpay/stripe/manual; coupon_code already records the free-order reason.
    const orderRows = await sql`
      INSERT INTO orders (user_email, user_name, user_phone, status, provider, total_amount_paise, currency, coupon_code, discount_paise, plan_id)
      VALUES (${session.email}, ${name}, ${phone}, 'pending_payment', ${useRazorpay ? "razorpay" : "manual"}, ${amountPaise}, ${orderCurrency}, ${appliedCoupon}, ${discountPaise}, ${dbPlanId})
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
    const successUrl = `${siteUrl}/learn/dashboard?payment=success`;

    if (isFreeOrder) {
      await sql`
        INSERT INTO payments (order_id, provider_payment_id, status)
        VALUES (${orderId}, ${orderId}, 'created')
      `;
      await fulfillOrder(orderId, { providerPaymentId: orderId });

      // If this session has never set a password (e.g. reached checkout via a magic
      // link tied to a prior order/entitlement), prompt them to create one now.
      try {
        const authRows = await sql`SELECT 1 FROM user_auth WHERE lower(email) = ${session.email.toLowerCase()} LIMIT 1`;
        if (Array.isArray(authRows) && authRows.length === 0) {
          const resetToken = await createResetToken(session.email);
          const resetLink = `${siteUrl}/reset-password?token=${resetToken}`;
          await sendCreatePasswordEmail(session.email, resetLink);
        }
      } catch (e) {
        console.error("Create-password email (free order):", e);
      }

      return NextResponse.json({
        orderId,
        free: true,
        redirectUrl: successUrl,
      });
    }

    if (!useRazorpay) {
      await sql`
        INSERT INTO payments (order_id, provider_payment_id, status)
        VALUES (${orderId}, ${orderId}, 'created')
      `;
      return NextResponse.json({
        orderId,
        paymentMethod: "manual",
        amountPaise,
        currency: orderCurrency,
        name: "Japanese with Avnish",
        description: displayName,
      });
    }

    const { client: razorpay } = createRazorpayClient();
    const rzOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: orderCurrency,
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
      currency: orderCurrency,
      name: "Japanese with Avnish",
      description: stripForRazorpay(displayName),
      redirectUrl: successUrl,
    });
  } catch (e) {
    console.error("Create order:", e);
    if (getRazorpayErrorStatus(e) === 401) {
      return NextResponse.json({ error: "Razorpay authentication failed" }, { status: 401 });
    }
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
