import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { sendOrderConfirmation } from "@/lib/email";
import { createAccessToken } from "@/lib/access-tokens";

type NeonSql = NonNullable<typeof sql>;

async function requireAdmin() {
  return getAdminSession();
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId } = await params;
  if (!orderId) {
    return NextResponse.json({ error: "Order ID required" }, { status: 400 });
  }

  if (!sql) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }
  try {
    return await resendNeon(sql, orderId);
  } catch (e) {
    console.error("Resend order email:", e);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}

const RESEND_LOCK_MINUTES = 15;

async function resendNeon(db: NeonSql, orderId: string) {
  const rows = await db`
    SELECT id, user_email, user_name, last_confirmation_email_at
    FROM orders WHERE id = ${orderId} LIMIT 1
  ` as { id: string; user_email: string; user_name: string | null; last_confirmation_email_at: string | null }[];
  const order = rows[0];
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const lastSent = order.last_confirmation_email_at ? new Date(order.last_confirmation_email_at) : null;
  const lockUntil = lastSent ? lastSent.getTime() + RESEND_LOCK_MINUTES * 60 * 1000 : 0;
  if (Date.now() < lockUntil) {
    const retryAfterMinutes = Math.ceil((lockUntil - Date.now()) / 60000);
    return NextResponse.json(
      { locked: true, retryAfterMinutes, message: `Email sent recently. Try again in ${retryAfterMinutes} min.` },
      { status: 429 }
    );
  }

  const slugRows = await db`SELECT p.slug FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ${orderId} LIMIT 1` as { slug: string }[];
  const productSlug = slugRows[0]?.slug ?? null;
  const accessToken = await createAccessToken(order.user_email, orderId);
  await sendOrderConfirmation(order.user_email, order.user_name || "there", orderId, {
    accessToken,
    productSlug,
  });
  await db`UPDATE orders SET last_confirmation_email_at = NOW() WHERE id = ${orderId}`;
  return NextResponse.json({ ok: true });
}
