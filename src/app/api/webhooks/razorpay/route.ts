import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { sql } from "@/lib/db";
import { sendOrderConfirmation, sendPaymentFailedRetryEmail } from "@/lib/email";
import { createAccessToken } from "@/lib/access-tokens";
import { addToSubscribers } from "@/lib/subscribers";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

function verifySignature(body: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) return false;
  const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
  return expected === signature;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";

    if (!verifySignature(body, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(body);

    if (event.event === "payment.failed") {
      const paymentEntity = event.payload?.payment?.entity;
      if (!paymentEntity?.id || !sql) {
        return NextResponse.json({ received: true });
      }
      const razorpayOrderId = paymentEntity.order_id;
      const payRows = await sql`SELECT order_id FROM payments WHERE provider_payment_id = ${razorpayOrderId} LIMIT 1` as { order_id: string }[];
      const orderId = payRows[0]?.order_id ?? null;
      if (!orderId) return NextResponse.json({ received: true });
      const orderRows = await sql`SELECT user_email, user_name FROM orders WHERE id = ${orderId} LIMIT 1` as { user_email: string; user_name: string }[];
      const order = orderRows[0];
      if (!order) return NextResponse.json({ received: true });
      const slugRows = await sql`SELECT p.slug, p.name FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ${orderId} LIMIT 1` as { slug: string; name: string }[];
      const productSlug = slugRows[0]?.slug ?? null;
      const productName = slugRows[0]?.name ?? undefined;
      const productUrl = productSlug ? `${SITE_URL.replace(/\/$/, "")}/product/${productSlug}` : `${SITE_URL}/store`;
      try {
        await sendPaymentFailedRetryEmail(order.user_email, (order.user_name as string) || "there", productUrl, productName);
      } catch (e) {
        console.error("Payment failed retry email:", e);
      }
      return NextResponse.json({ received: true });
    }

    if (event.event !== "payment.captured") {
      return NextResponse.json({ received: true });
    }

    const paymentEntity = event.payload?.payment?.entity;
    if (!paymentEntity?.id) {
      return NextResponse.json({ error: "Missing payment" }, { status: 400 });
    }

    const razorpayOrderId = paymentEntity.order_id;
    const notesOrderId = paymentEntity.notes?.order_id;

    if (!sql) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    let orderId: string | null = notesOrderId || null;
    if (!orderId && razorpayOrderId) {
      const payRows = await sql`SELECT order_id FROM payments WHERE provider_payment_id = ${razorpayOrderId} LIMIT 1` as { order_id: string }[];
      orderId = payRows[0]?.order_id ?? null;
    }
    if (!orderId) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const orderRows = await sql`SELECT id, user_email, user_name, status FROM orders WHERE id = ${orderId} LIMIT 1`;
    const order = orderRows[0];
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.status === "paid") {
      return NextResponse.json({ received: true, idempotent: true });
    }

    await sql`UPDATE payments SET status = 'paid', raw_event_ref = ${event.id} WHERE order_id = ${orderId}`;
    await sql`UPDATE orders SET status = 'paid' WHERE id = ${orderId}`;

    const items = await sql`SELECT product_id FROM order_items WHERE order_id = ${orderId}`;
    const userEmail = order.user_email as string;

    for (const item of items) {
      await sql`
        INSERT INTO entitlements (user_email, product_id, order_id, active)
        VALUES (${userEmail}, ${item.product_id}, ${orderId}, true)
        ON CONFLICT (user_email, product_id) DO UPDATE SET order_id = ${orderId}, active = true
      `;
    }

    const slugRows = await sql`SELECT p.slug FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ${orderId} LIMIT 1` as { slug: string }[];
    const productSlug = slugRows[0]?.slug ?? null;

    try {
      await addToSubscribers(userEmail, { name: order.user_name as string, source: "purchase" });
    } catch (e) {
      console.error("Add to subscribers:", e);
    }
    try {
      const accessToken = await createAccessToken(userEmail, orderId);
      await sendOrderConfirmation(userEmail, (order.user_name as string) || "there", orderId, {
        accessToken,
        productSlug,
      });
      await sql`UPDATE orders SET last_confirmation_email_at = NOW() WHERE id = ${orderId}`;
      console.info("[Webhook] Order confirmation email sent to", userEmail, "orderId", orderId);
    } catch (e) {
      console.error("[Webhook] Order confirmation email failed:", e instanceof Error ? e.message : e);
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("Razorpay webhook:", e);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
