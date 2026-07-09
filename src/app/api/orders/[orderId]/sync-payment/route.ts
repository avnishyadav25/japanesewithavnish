import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { createAccessToken } from "@/lib/access-tokens";
import { getDriveUrlForSlug } from "@/lib/drive-url";
import { createRazorpayClient, getRazorpayKeyId, getRazorpayKeySecret } from "@/lib/razorpay";
import { fulfillOrder } from "@/lib/order-fulfillment";

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

  const keyId = getRazorpayKeyId();
  const keySecret = getRazorpayKeySecret();
  if (!keyId || !keySecret) {
    return NextResponse.json({ error: "Razorpay not configured" }, { status: 500 });
  }

  if (!sql) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }
  try {
    return await syncNeon(sql, orderId);
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

async function syncNeon(db: NeonSql, orderId: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const orderRows = await db`
    SELECT o.id, o.user_email, o.user_name, o.status, p.provider_payment_id, p.provider_order_id
    FROM orders o
    LEFT JOIN payments p ON p.order_id = o.id
    WHERE o.id = ${orderId}
    LIMIT 1
  ` as { id: string; user_email: string; user_name: string; status: string; provider_payment_id: string | null; provider_order_id: string | null }[];

  const row = orderRows[0];
  if (!row) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (row.status === "paid") {
    const { accessUrl, orderDetailUrl } = await getAccessUrlsNeon(db, orderId, row.user_email, siteUrl);
    return NextResponse.json({ ok: true, already: true, accessUrl, orderDetailUrl });
  }
  const razorpayOrderId = row.provider_order_id || row.provider_payment_id;
  if (!razorpayOrderId) {
    return NextResponse.json({ error: "No Razorpay order linked" }, { status: 400 });
  }

  const { client: razorpay } = createRazorpayClient();
  const rzOrder = await razorpay.orders.fetch(razorpayOrderId);
  const rzOrderObj = rzOrder as { status?: string };
  if (rzOrderObj.status !== "paid") {
    return NextResponse.json({ ok: true, pending: true, razorpayStatus: rzOrderObj.status });
  }

  await db`
    UPDATE payments
    SET status = 'captured',
        provider_order_id = COALESCE(provider_order_id, ${razorpayOrderId}),
        captured_at = COALESCE(captured_at, NOW())
    WHERE order_id = ${orderId}
  `;
  await fulfillOrder(orderId, { providerOrderId: razorpayOrderId });

  const { accessUrl, orderDetailUrl } = await getAccessUrlsNeon(db, orderId, row.user_email, siteUrl);
  return NextResponse.json({ ok: true, synced: true, accessUrl, orderDetailUrl });
}
