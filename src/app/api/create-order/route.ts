import { NextResponse } from "next/server";
import { createRazorpayClient, getRazorpayErrorStatus } from "@/lib/razorpay";

export async function POST(req: Request) {
  try {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_GENERIC_RAZORPAY_ORDER_ENDPOINT !== "true") {
      return NextResponse.json({ error: "Use the product checkout endpoint" }, { status: 404 });
    }

    const body = await req.json();
    const amount = Number(body.amount);
    const currency = String(body.currency || "INR").toUpperCase();
    const receipt = body.receipt ? String(body.receipt) : `receipt_${Date.now()}`;

    if (!Number.isInteger(amount) || amount < 100) {
      return NextResponse.json({ error: "Amount must be at least 100 paise" }, { status: 400 });
    }

    const { client } = createRazorpayClient();
    const order = await client.orders.create({
      amount,
      currency,
      receipt,
    });

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error("Razorpay create order:", error);
    const status = getRazorpayErrorStatus(error);
    if (status === 401) {
      return NextResponse.json({ error: "Razorpay authentication failed" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Razorpay not configured") {
      return NextResponse.json({ error: "Razorpay not configured" }, { status: 500 });
    }
    return NextResponse.json({ error: "Failed to create Razorpay order" }, { status: 500 });
  }
}
