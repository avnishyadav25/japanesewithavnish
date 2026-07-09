import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { fulfillOrder } from "@/lib/order-fulfillment";
import { createRazorpayClient, verifyRazorpayPaymentSignature } from "@/lib/razorpay";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const razorpayOrderId = String(body.razorpay_order_id || "");
    const razorpayPaymentId = String(body.razorpay_payment_id || "");
    const razorpaySignature = String(body.razorpay_signature || "");
    const localOrderId = body.orderId ? String(body.orderId) : "";

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json({ error: "Missing payment verification fields" }, { status: 400 });
    }

    const isValid = verifyRazorpayPaymentSignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });

    if (!isValid) {
      return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
    }

    if (!sql) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 });
    }

    const rows = localOrderId
      ? await sql`
          SELECT
            p.order_id,
            o.total_amount_paise,
            o.status AS order_status
          FROM payments p
          JOIN orders o ON o.id = p.order_id
          WHERE p.order_id = ${localOrderId}
            AND (p.provider_order_id = ${razorpayOrderId} OR p.provider_payment_id = ${razorpayOrderId})
          LIMIT 1
        ` as { order_id: string; total_amount_paise: number; order_status: string }[]
      : await sql`
          SELECT
            p.order_id,
            o.total_amount_paise,
            o.status AS order_status
          FROM payments p
          JOIN orders o ON o.id = p.order_id
          WHERE p.provider_order_id = ${razorpayOrderId} OR p.provider_payment_id = ${razorpayOrderId}
          LIMIT 1
        ` as { order_id: string; total_amount_paise: number; order_status: string }[];

    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: "Payment order not found" }, { status: 404 });
    }

    const { client: razorpay } = createRazorpayClient();
    const payment = await razorpay.payments.fetch(razorpayPaymentId);
    const paymentData = payment as {
      id?: string;
      order_id?: string;
      amount?: number | string;
      currency?: string;
      status?: string;
    };

    if (
      paymentData.id !== razorpayPaymentId ||
      paymentData.order_id !== razorpayOrderId ||
      Number(paymentData.amount) !== Number(row.total_amount_paise) ||
      String(paymentData.currency || "").toUpperCase() !== "INR"
    ) {
      return NextResponse.json({ error: "Payment details do not match this order" }, { status: 400 });
    }

    const paymentStatus = String(paymentData.status || "");
    if (!["authorized", "captured"].includes(paymentStatus)) {
      return NextResponse.json({ error: "Payment is not successful", status: paymentStatus }, { status: 400 });
    }

    const orderId = row.order_id;
    await sql`
      UPDATE payments
      SET status = ${paymentStatus === "captured" ? "captured" : "authorized"},
          provider_payment_id = ${razorpayPaymentId},
          provider_order_id = ${razorpayOrderId},
          provider_signature = ${razorpaySignature},
          raw_event_ref = ${razorpayPaymentId},
          captured_at = ${paymentStatus === "captured" ? new Date().toISOString() : null}
      WHERE order_id = ${orderId}
    `;
    await fulfillOrder(orderId, { providerPaymentId: razorpayPaymentId, providerOrderId: razorpayOrderId });

    return NextResponse.json({ success: true, orderId });
  } catch (error) {
    console.error("Razorpay verify payment:", error);
    return NextResponse.json({ error: "Payment verification failed" }, { status: 500 });
  }
}
