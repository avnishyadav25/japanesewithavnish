import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { sql } from "@/lib/db";
import { fulfillOrder } from "@/lib/order-fulfillment";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

function unixToIso(value: number | null | undefined): string | null {
  return typeof value === "number" ? new Date(value * 1000).toISOString() : null;
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const raw = (invoice as any).subscription;
  if (!raw) return null;
  return typeof raw === "string" ? raw : raw.id || null;
}

function getInvoicePaymentId(invoice: Stripe.Invoice): string {
  const raw = (invoice as any).payment_intent;
  if (!raw) return invoice.id;
  return typeof raw === "string" ? raw : raw.id || invoice.id;
}

function normalizeSubscriptionStatus(status: string | null | undefined): string {
  if (status === "canceled" || status === "cancelled") return "cancelled";
  if (status === "trialing") return "trialing";
  if (status === "past_due" || status === "unpaid" || status === "incomplete" || status === "incomplete_expired") {
    return "past_due";
  }
  return "active";
}

async function syncStripeSubscriptionAccess(args: {
  stripe: Stripe;
  subscriptionId: string;
  customerId: string | null;
  userEmail: string;
  planId: string;
  status?: string | null;
  cancelAtPeriodEnd?: boolean | null;
}) {
  if (!sql) throw new Error("Database unavailable");

  const subscription = await args.stripe.subscriptions.retrieve(args.subscriptionId);
  const subAny = subscription as any;
  const periodStart = unixToIso(subAny.current_period_start) || new Date().toISOString();
  const periodEnd = unixToIso(subAny.current_period_end);
  const cancelAt = Boolean(args.cancelAtPeriodEnd ?? subAny.cancel_at_period_end ?? false);
  const cancelledAt = unixToIso(subAny.canceled_at);
  const status = normalizeSubscriptionStatus(args.status || subscription.status || "active");

  await sql`
    UPDATE profiles
    SET stripe_customer_id = COALESCE(stripe_customer_id, ${args.customerId}),
        premium_until = COALESCE(${periodEnd}, premium_until),
        is_lifetime = COALESCE(is_lifetime, false),
        role = CASE WHEN COALESCE(${periodEnd}::timestamptz, premium_until) > NOW() THEN 'premium_student' ELSE role END,
        subscription_status = ${status},
        updated_at = NOW()
    WHERE email = ${args.userEmail}
  `;

  const existingRows = await sql`
    SELECT id
    FROM user_subscriptions
    WHERE provider = 'stripe'
      AND (provider_subscription_id = ${args.subscriptionId}
        OR (user_email = ${args.userEmail} AND plan_id = ${args.planId} AND provider_subscription_id IS NULL))
    ORDER BY created_at DESC
    LIMIT 1
  ` as { id: string }[];

  if (existingRows[0]?.id) {
    await sql`
      UPDATE user_subscriptions
      SET provider_customer_id = ${args.customerId},
          provider_subscription_id = ${args.subscriptionId},
          status = ${status},
          current_period_start = ${periodStart},
          current_period_end = ${periodEnd},
          cancel_at_period_end = ${cancelAt},
          cancelled_at = COALESCE(${cancelledAt}, cancelled_at),
          updated_at = NOW()
      WHERE id = ${existingRows[0].id}
    `;
    return existingRows[0].id;
  }

  const rows = await sql`
    INSERT INTO user_subscriptions (
      user_email, plan_id, status, provider, provider_customer_id, provider_subscription_id,
      started_at, current_period_start, current_period_end, cancel_at_period_end, cancelled_at
    )
    VALUES (
      ${args.userEmail}, ${args.planId}, ${status}, 'stripe',
      ${args.customerId}, ${args.subscriptionId}, NOW(), ${periodStart}, ${periodEnd}, ${cancelAt}, ${cancelledAt}
    )
    RETURNING id
  ` as { id: string }[];
  return rows[0]?.id || null;
}

async function getPlanIdFromStripePrice(priceId: string | null | undefined) {
  if (!priceId || !sql) return null;
  const rows = await sql`
    SELECT id
    FROM subscription_plans
    WHERE stripe_price_id = ${priceId}
       OR slug = CASE
          WHEN ${priceId} = ${process.env.STRIPE_PRICE_MONTHLY || ""} THEN 'monthly'
          WHEN ${priceId} = ${process.env.STRIPE_PRICE_YEARLY || ""} THEN 'yearly'
          WHEN ${priceId} = ${process.env.STRIPE_PRICE_LIFETIME || ""} THEN 'lifetime'
          ELSE ''
        END
    LIMIT 1
  ` as { id: string }[];
  return rows[0]?.id || null;
}

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "dummy_key", {
    apiVersion: "2023-10-16" as any,
  });
  try {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature") || "";

    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET not configured");
      return NextResponse.json({ error: "Webhook secret missing" }, { status: 500 });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err: any) {
      console.error(`Stripe Webhook Signature Verification failed: ${err.message}`);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      const sessionId = session.id;

      if (!orderId) {
        console.error("No orderId found in Stripe Checkout Session metadata");
        return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
      }

      if (!sql) {
        return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
      }

      const orderRows = await sql`SELECT id, status, user_email, plan_id FROM orders WHERE id = ${orderId} LIMIT 1`;
      const order = orderRows[0];
      if (!order) {
        console.error(`Order ${orderId} not found in database`);
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }

      await sql`
        UPDATE payments
        SET status = 'captured',
            raw_event_ref = ${event.id},
            provider_order_id = COALESCE(provider_order_id, ${typeof session.subscription === "string" ? session.subscription : session.subscription?.id || null}),
            provider_invoice_id = COALESCE(provider_invoice_id, ${typeof session.invoice === "string" ? session.invoice : session.invoice?.id || null})
        WHERE order_id = ${orderId} AND provider_payment_id = ${sessionId}
      `;

      const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id || null;
      if (customerId) {
        await sql`
          UPDATE profiles
          SET stripe_customer_id = COALESCE(stripe_customer_id, ${customerId}), updated_at = NOW()
          WHERE email = ${order.user_email}
        `;
      }

      if (session.mode === "subscription") {
        const subscriptionId =
          typeof session.subscription === "string" ? session.subscription : session.subscription?.id || null;
        if (subscriptionId && order.plan_id) {
          await fulfillOrder(orderId, {
            providerPaymentId: session.payment_intent ? String(session.payment_intent) : session.id,
            providerOrderId: subscriptionId,
          });
          await syncStripeSubscriptionAccess({
            stripe,
            subscriptionId,
            customerId,
            userEmail: order.user_email,
            planId: order.plan_id,
          });
        }
      } else if (order.status !== "paid") {
        await fulfillOrder(orderId, {
          providerPaymentId: session.payment_intent ? String(session.payment_intent) : session.id,
          providerOrderId: session.id,
        });
      }

      return NextResponse.json({ received: true });
    }

    if (event.type === "invoice.payment_succeeded") {
      if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = getInvoiceSubscriptionId(invoice);
      if (!subscriptionId) return NextResponse.json({ received: true });

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const subAny = subscription as any;
      const metadata = subscription.metadata || {};
      const orderId = metadata.orderId || invoice.metadata?.orderId || null;
      const userEmail = metadata.userEmail || invoice.customer_email || null;
      const priceId = subAny.items?.data?.[0]?.price?.id || null;
      const planId = metadata.planId || (await getPlanIdFromStripePrice(priceId));
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id || null;

      if (!userEmail || !planId) {
        console.error("Stripe invoice missing userEmail or planId", { invoiceId: invoice.id, subscriptionId });
        return NextResponse.json({ received: true, skipped: true });
      }

      const subscriptionRowId = await syncStripeSubscriptionAccess({
        stripe,
        subscriptionId,
        customerId,
        userEmail,
        planId,
        status: subscription.status,
      });

      if (orderId) {
        await sql`
          UPDATE payments
          SET status = 'captured',
              raw_event_ref = ${event.id},
              provider_invoice_id = ${invoice.id},
              provider_order_id = COALESCE(provider_order_id, ${subscriptionId})
          WHERE order_id = ${orderId}
        `;
        const orderRows = await sql`SELECT status FROM orders WHERE id = ${orderId} LIMIT 1` as { status: string }[];
        if (orderRows[0]?.status !== "paid") {
          await fulfillOrder(orderId, {
            providerPaymentId: getInvoicePaymentId(invoice),
            providerOrderId: subscriptionId,
          });
        }
      }

      if ((invoice as any).billing_reason !== "subscription_create") {
        await sql`
          INSERT INTO subscription_payments (
            user_email, subscription_id, plan_id, provider, provider_payment_id, provider_order_id,
            provider_invoice_id, amount, currency, status, paid_at, raw_webhook_event_id
          )
          VALUES (
            ${userEmail}, ${subscriptionRowId}, ${planId}, 'stripe', ${getInvoicePaymentId(invoice)},
            ${subscriptionId}, ${invoice.id}, ${invoice.amount_paid || 0}, ${String(invoice.currency || "usd").toUpperCase()},
            'paid', NOW(), ${event.id}
          )
          ON CONFLICT (provider_payment_id) DO NOTHING
        `;
      }

      return NextResponse.json({ received: true });
    }

    if (event.type === "invoice.payment_failed") {
      if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = getInvoiceSubscriptionId(invoice);
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id || null;
      await sql`
        UPDATE user_subscriptions
        SET status = 'past_due', updated_at = NOW()
        WHERE provider = 'stripe'
          AND (provider_subscription_id = ${subscriptionId} OR provider_customer_id = ${customerId})
      `;
      await sql`
        UPDATE profiles
        SET subscription_status = 'past_due', updated_at = NOW()
        WHERE stripe_customer_id = ${customerId}
      `;
      return NextResponse.json({ received: true });
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
      const subscription = event.data.object as Stripe.Subscription;
      const subAny = subscription as any;
      const userEmail = subscription.metadata?.userEmail || null;
      const planId = subscription.metadata?.planId || (await getPlanIdFromStripePrice(subAny.items?.data?.[0]?.price?.id));
      const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id || null;

      const profileRows = userEmail
        ? []
        : await sql`SELECT email FROM profiles WHERE stripe_customer_id = ${customerId} LIMIT 1` as { email: string }[];
      const resolvedEmail = userEmail || profileRows[0]?.email || null;

      if (resolvedEmail && planId) {
        await syncStripeSubscriptionAccess({
          stripe,
          subscriptionId: subscription.id,
          customerId,
          userEmail: resolvedEmail,
          planId,
          status: event.type === "customer.subscription.deleted" ? "cancelled" : subscription.status,
          cancelAtPeriodEnd: subAny.cancel_at_period_end,
        });
      }
      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe Webhook handler failed:", error);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
export const dynamic = "force-dynamic";
