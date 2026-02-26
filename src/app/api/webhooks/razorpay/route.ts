import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOrderConfirmation } from "@/lib/email";

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
    if (event.event !== "payment.captured") {
      return NextResponse.json({ received: true });
    }

    const paymentId = event.payload.payment?.entity?.id;
    const orderId = event.payload.payment?.entity?.notes?.order_id;

    if (!paymentId || !orderId) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: order } = await supabase
      .from("orders")
      .select("id, user_email, user_name, status")
      .eq("id", orderId)
      .single();

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.status === "paid") {
      return NextResponse.json({ received: true, idempotent: true });
    }

    await supabase.from("payments").update({
      status: "paid",
      raw_event_ref: event.id,
    }).eq("order_id", orderId);

    await supabase.from("orders").update({ status: "paid" }).eq("id", orderId);

    const { data: items } = await supabase
      .from("order_items")
      .select("product_id")
      .eq("order_id", orderId);

    for (const item of items || []) {
      await supabase.from("entitlements").upsert(
        {
          user_email: order.user_email,
          product_id: item.product_id,
          order_id: orderId,
          active: true,
        },
        { onConflict: "user_email,product_id" }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    try {
      await sendOrderConfirmation(
        order.user_email,
        order.user_name || "there",
        `${siteUrl}/library`,
        orderId
      );
    } catch (e) {
      console.error("Order confirmation email:", e);
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("Razorpay webhook:", e);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
