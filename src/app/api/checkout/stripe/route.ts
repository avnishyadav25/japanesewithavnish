import { NextResponse } from "next/server";
import Stripe from "stripe";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

function getEnvPriceId(slug: string, billingType: string): string | null {
  const normalized = slug.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  return (
    process.env[`STRIPE_PRICE_${normalized}`] ||
    process.env[`STRIPE_PRICE_${billingType.toUpperCase()}`] ||
    null
  );
}

function getStripePriceConfig(plan: {
  slug: string;
  billing_type: string;
  stripe_price_id: string | null;
}) {
  const dbPriceId = plan.stripe_price_id?.trim() || null;
  const envPriceId = getEnvPriceId(plan.slug, plan.billing_type)?.trim() || null;
  const candidates = [dbPriceId, envPriceId].filter(Boolean) as string[];
  const priceId = candidates.find((candidate) => candidate.startsWith("price_")) || null;
  const productId = candidates.find((candidate) => candidate.startsWith("prod_")) || null;

  return { priceId, productId, hasConfiguredValue: candidates.length > 0 };
}

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "dummy_key", {
    apiVersion: "2023-10-16" as any,
  });
  try {
    const sessionUser = await getSession();
    if (!sessionUser?.email) {
      return NextResponse.json({ error: "Please log in before checkout", loginRequired: true }, { status: 401 });
    }

    const { planId, name, email, phone, couponCode } = await req.json();
    if (!planId || !name || !email || !phone) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    if (String(email).toLowerCase() !== sessionUser.email.toLowerCase()) {
      return NextResponse.json({ error: "Checkout email must match your logged-in account" }, { status: 400 });
    }

    if (!sql) {
      return NextResponse.json({ error: "Checkout unavailable" }, { status: 503 });
    }

    const planRows = await sql`
      SELECT id, name, slug, billing_type, price_usd, stripe_price_id
      FROM subscription_plans
      WHERE id::text = ${planId} OR slug = ${planId} LIMIT 1
    ` as { id: string; name: string; slug: string; billing_type: string; price_usd: number; stripe_price_id: string | null }[];
    const plan = planRows[0];
    if (!plan) {
      return NextResponse.json({ error: "Subscription plan not found" }, { status: 404 });
    }
    if (!["monthly", "yearly", "lifetime"].includes(plan.billing_type)) {
      return NextResponse.json({ error: "Unsupported plan type" }, { status: 400 });
    }

    const stripePriceConfig = getStripePriceConfig(plan);
    if (!stripePriceConfig.priceId) {
      if (stripePriceConfig.productId) {
        return NextResponse.json(
          {
            error:
              "Stripe is configured with a Product ID. Use the Stripe Price ID that starts with price_ for this plan.",
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        {
          error: stripePriceConfig.hasConfiguredValue
            ? "Stripe price ID is invalid for this plan"
            : "Stripe price ID is not configured for this plan",
        },
        { status: 500 }
      );
    }
    const stripePriceId = stripePriceConfig.priceId;

    const amountCents = Number(plan.price_usd);
    let discountCents = 0;
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
                            productIds.includes(plan.id);

        if (!expired && !limitReached && validItem) {
          const discountValue = Number(coupon.discount_value);
          if (coupon.discount_type === "percent") {
            discountCents = Math.round((amountCents * discountValue) / 100);
          } else {
            discountCents = Math.min(discountValue, amountCents);
          }
          appliedCoupon = code;
        }
      }
    }

    if (amountCents < 50) {
      return NextResponse.json({ error: "Amount too low for payment (min $0.50)" }, { status: 400 });
    }

    const orderRows = await sql`
      INSERT INTO orders (user_email, user_name, user_phone, status, provider, total_amount_paise, coupon_code, discount_paise, plan_id)
      VALUES (${sessionUser.email}, ${name}, ${phone}, 'pending_payment', 'stripe', ${Math.max(0, amountCents - discountCents)}, ${appliedCoupon}, ${discountCents}, ${plan.id})
      RETURNING id
    `;
    const order = orderRows[0];
    if (!order) {
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }
    const orderId = order.id as string;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const mode = plan.billing_type === "lifetime" ? "payment" : "subscription";
    const metadata = {
      orderId,
      planId: plan.id,
      planSlug: plan.slug,
      billingType: plan.billing_type,
      userEmail: sessionUser.email,
    };

    const checkoutParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ["card"],
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      mode,
      customer_email: sessionUser.email,
      metadata,
      success_url: `${siteUrl}/learn/dashboard?payment=success`,
      cancel_url: `${siteUrl}/pricing`,
    };

    if (mode === "subscription") {
      checkoutParams.subscription_data = { metadata };
    }

    if (discountCents > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: discountCents,
        currency: "usd",
        duration: mode === "subscription" ? "once" : "forever",
        name: appliedCoupon ? `Coupon ${appliedCoupon}` : "Checkout discount",
      });
      checkoutParams.discounts = [{ coupon: coupon.id }];
    }

    const session = await stripe.checkout.sessions.create(checkoutParams);

    await sql`
      INSERT INTO payments (order_id, provider_payment_id, status)
      VALUES (${orderId}, ${session.id}, 'created')
    `;

    return NextResponse.json({ sessionUrl: session.url });
  } catch (error) {
    console.error("Stripe Checkout error:", error);
    if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      const raw = error.raw as { message?: string } | undefined;
      const message = raw?.message || error.message;
      if (message.includes("a similar object exists in live mode") && process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
        return NextResponse.json(
          {
            error:
              "Stripe mode mismatch: you are using a test secret key with a live Price ID. Use test Price IDs, or switch all Stripe keys to live mode.",
          },
          { status: 500 }
        );
      }
      if (message.includes("a similar object exists in test mode") && process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_")) {
        return NextResponse.json(
          {
            error:
              "Stripe mode mismatch: you are using a live secret key with a test Price ID. Use live Price IDs, or switch all Stripe keys to test mode.",
          },
          { status: 500 }
        );
      }
      if (
        message.includes("only registered Indian businesses") ||
        message.includes("can accept international payments")
      ) {
        return NextResponse.json(
          {
            error:
              "Stripe international payments are not enabled for this account. Indian Stripe accounts must be registered/approved as a business for international payments, or use Razorpay/INR checkout until Stripe export payments are enabled.",
          },
          { status: 500 }
        );
      }
      if (error.code === "resource_missing" && error.param === "line_items[0][price]") {
        return NextResponse.json(
          { error: "Stripe Price ID was not found. Confirm the plan uses a Price ID that starts with price_ and belongs to the same Stripe mode as your secret key." },
          { status: 500 }
        );
      }
    }
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
