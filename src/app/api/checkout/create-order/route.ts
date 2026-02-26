import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const { productId, name, email, phone } = await req.json();
    if (!productId || !name || !email || !phone) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, name, price_paise")
      .eq("id", productId)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const amountPaise = product.price_paise;
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_email: email,
        user_name: name,
        user_phone: phone,
        status: "pending_payment",
        provider: "razorpay",
        total_amount_paise: amountPaise,
      })
      .select("id")
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }

    await supabase.from("order_items").insert({
      order_id: order.id,
      product_id: productId,
      quantity: 1,
      price_paise: amountPaise,
    });

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return NextResponse.json({ error: "Razorpay not configured" }, { status: 500 });
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const rzOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: order.id,
      notes: { order_id: order.id },
    });

    await supabase.from("payments").insert({
      order_id: order.id,
      provider_payment_id: rzOrder.id,
      status: "created",
    });

    return NextResponse.json({
      orderId: order.id,
      razorpayOrderId: rzOrder.id,
      key: keyId,
      amount: amountPaise,
      name: "Japanese with Avnish",
      description: product.name,
      redirectUrl: `${siteUrl}/thank-you?order=${order.id}`,
    });
  } catch (e) {
    console.error("Create order:", e);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
