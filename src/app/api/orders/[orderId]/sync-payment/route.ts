import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import { sql } from "@/lib/db";
import { sendOrderConfirmation } from "@/lib/email";
import { createAccessToken } from "@/lib/access-tokens";
import { addToSubscribers } from "@/lib/subscribers";
import { getDriveUrlForSlug } from "@/lib/drive-url";

/**
 * Sync payment status from Razorpay and, if paid, update order + entitlements + send email.
 * Call this from the thank-you page so missed webhooks still trigger email and dashboard update.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  if (!orderId) {
    return NextResponse.json({ error: "Order ID required" }, { status: 400 });
  }

  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return NextResponse.json({ error: "Razorpay not configured" }, { status: 500 });
  }

  if (!sql) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }
  try {
    return await syncNeon(sql, orderId, keyId, keySecret);
  } catch (e) {
    console.error("Sync payment:", e);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

type NeonSql = NonNullable<typeof sql>;

async function getAccessUrlsNeon(
  db: NeonSql,
  orderId: string,
  userEmail: string,
  siteUrl: string
): Promise<{ accessUrl: string; orderDetailUrl: string }> {
  const token = await createAccessToken(userEmail, orderId);
  const slugRows = await db`SELECT p.slug FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ${orderId} LIMIT 1` as { slug: string }[];
  const productSlug = slugRows[0]?.slug ?? null;
  const driveUrl = productSlug ? getDriveUrlForSlug(productSlug) : null;
  const accessUrl = driveUrl || `${siteUrl}/access?token=${token}`;
  const orderDetailUrl = `${siteUrl}/order/${orderId}?token=${token}`;
  return { accessUrl, orderDetailUrl };
}

async function syncNeon(db: NeonSql, orderId: string, keyId: string, keySecret: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const orderRows = await db`
    SELECT o.id, o.user_email, o.user_name, o.status, p.provider_payment_id
    FROM orders o
    LEFT JOIN payments p ON p.order_id = o.id
    WHERE o.id = ${orderId}
    LIMIT 1
  ` as { id: string; user_email: string; user_name: string; status: string; provider_payment_id: string | null }[];

  const row = orderRows[0];
  if (!row) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (row.status === "paid") {
    const { accessUrl, orderDetailUrl } = await getAccessUrlsNeon(db, orderId, row.user_email, siteUrl);
    return NextResponse.json({ ok: true, already: true, accessUrl, orderDetailUrl });
  }
  if (!row.provider_payment_id) {
    return NextResponse.json({ error: "No Razorpay order linked" }, { status: 400 });
  }

  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  const rzOrder = await razorpay.orders.fetch(row.provider_payment_id);
  const rzOrderObj = rzOrder as { status?: string };
  if (rzOrderObj.status !== "paid") {
    return NextResponse.json({ ok: true, pending: true, razorpayStatus: rzOrderObj.status });
  }

  await db`UPDATE payments SET status = 'paid' WHERE order_id = ${orderId}`;
  await db`UPDATE orders SET status = 'paid' WHERE id = ${orderId}`;

  const items = await db`SELECT product_id FROM order_items WHERE order_id = ${orderId}` as { product_id: string }[];
  const userEmail = row.user_email;

  for (const item of items) {
    await db`
      INSERT INTO entitlements (user_email, product_id, order_id, active)
      VALUES (${userEmail}, ${item.product_id}, ${orderId}, true)
      ON CONFLICT (user_email, product_id) DO UPDATE SET order_id = ${orderId}, active = true
    `;
  }

  const slugRows = await db`SELECT p.slug FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ${orderId} LIMIT 1` as { slug: string }[];
  const productSlug = slugRows[0]?.slug ?? null;

  try {
    await addToSubscribers(userEmail, { name: row.user_name as string, source: "purchase" });
  } catch (e) {
    console.error("Add to subscribers:", e);
  }
  try {
    const accessToken = await createAccessToken(userEmail, orderId);
    await sendOrderConfirmation(userEmail, (row.user_name as string) || "there", orderId, {
      accessToken,
      productSlug,
    });
    await db`UPDATE orders SET last_confirmation_email_at = NOW() WHERE id = ${orderId}`;
    console.info("[SyncPayment] Order confirmation email sent to", userEmail, "orderId", orderId);
  } catch (e) {
    console.error("[SyncPayment] Order confirmation email failed:", e instanceof Error ? e.message : e);
  }

  const { accessUrl, orderDetailUrl } = await getAccessUrlsNeon(db, orderId, userEmail, siteUrl);
  return NextResponse.json({ ok: true, synced: true, accessUrl, orderDetailUrl });
}
