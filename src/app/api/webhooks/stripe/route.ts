import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { sql } from "@/lib/db";
import { fulfillOrder } from "@/lib/order-fulfillment";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

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

      // Check order status to avoid duplicate processing
      const orderRows = await sql`SELECT id, status FROM orders WHERE id = ${orderId} LIMIT 1`;
      const order = orderRows[0];
      if (!order) {
        console.error(`Order ${orderId} not found in database`);
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }

      if (order.status === "paid") {
        return NextResponse.json({ received: true, duplicate: true });
      }

      // Update payment record in database
      await sql`
        UPDATE payments
        SET status = 'captured', raw_event_ref = ${event.id}
        WHERE order_id = ${orderId} AND provider_payment_id = ${sessionId}
      `;

      // Fulfill subscription pass entitlements
      console.log(`Fulfilling Stripe Order ${orderId}...`);
      await fulfillOrder(orderId);

      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe Webhook handler failed:", error);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
export const dynamic = "force-dynamic";
