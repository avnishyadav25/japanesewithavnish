import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { sendOrderConfirmation } from "@/lib/email";
import { createAccessToken } from "@/lib/access-tokens";

type NeonSql = NonNullable<typeof sql>;
const RESEND_LOCK_MINUTES = 15;

async function resendOrder(db: NeonSql, orderId: string) {
  const rows = await db`
    SELECT id, user_email, user_name, last_confirmation_email_at
    FROM orders WHERE id = ${orderId} LIMIT 1
  ` as { id: string; user_email: string; user_name: string | null; last_confirmation_email_at: string | null }[];
  const order = rows[0];
  if (!order) return { status: 404 as const, body: { error: "Order not found" } };

  const lastSent = order.last_confirmation_email_at ? new Date(order.last_confirmation_email_at) : null;
  const lockUntil = lastSent ? lastSent.getTime() + RESEND_LOCK_MINUTES * 60 * 1000 : 0;
  if (Date.now() < lockUntil) {
    const retryAfterMinutes = Math.ceil((lockUntil - Date.now()) / 60000);
    return {
      status: 429 as const,
      body: { locked: true, retryAfterMinutes, message: `Email sent recently. Try again in ${retryAfterMinutes} min.` },
    };
  }

  const slugRows = await db`SELECT p.slug FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ${orderId} LIMIT 1` as { slug: string }[];
  const productSlug = slugRows[0]?.slug ?? null;
  const accessToken = await createAccessToken(order.user_email, orderId);
  await sendOrderConfirmation(order.user_email, order.user_name || "there", orderId, {
    accessToken,
    productSlug,
  });
  await db`UPDATE orders SET last_confirmation_email_at = NOW() WHERE id = ${orderId}`;
  return { status: 200 as const, body: { ok: true } };
}

export async function POST(req: NextRequest) {
  try {
    if (!sql) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

    const body = await req.json();
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!orderId || !email) return NextResponse.json({ error: "orderId and email required" }, { status: 400 });

    const rows = await sql`
      SELECT id, user_email FROM orders WHERE id = ${orderId} LIMIT 1
    ` as { id: string; user_email: string }[];
    const order = rows[0];
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.user_email.toLowerCase() !== email) return NextResponse.json({ error: "Email does not match this order" }, { status: 403 });

    const result = await resendOrder(sql, orderId);
    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    console.error("Resend confirmation:", e);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
