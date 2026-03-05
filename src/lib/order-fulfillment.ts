import { sql } from "@/lib/db";
import { sendOrderConfirmation } from "@/lib/email";
import { createAccessToken } from "@/lib/access-tokens";
import { addToSubscribers } from "@/lib/subscribers";

/**
 * Mark order as paid, grant entitlements, add to subscribers, and send confirmation email.
 * Idempotent: no-op if order is already paid.
 */
export async function fulfillOrder(orderId: string): Promise<void> {
  if (!sql) throw new Error("Database not configured");

  const orderRows = await sql`
    SELECT id, user_email, user_name, status FROM orders WHERE id = ${orderId} LIMIT 1
  ` as { id: string; user_email: string; user_name: string; status: string }[];
  const order = orderRows[0];
  if (!order) throw new Error("Order not found");
  if (order.status === "paid") return;

  await sql`UPDATE payments SET status = 'paid' WHERE order_id = ${orderId}`;
  await sql`UPDATE orders SET status = 'paid' WHERE id = ${orderId}`;

  const items = await sql`SELECT product_id FROM order_items WHERE order_id = ${orderId}` as { product_id: string }[];
  const userEmail = order.user_email;

  for (const item of items) {
    await sql`
      INSERT INTO entitlements (user_email, product_id, order_id, active)
      VALUES (${userEmail}, ${item.product_id}, ${orderId}, true)
      ON CONFLICT (user_email, product_id) DO UPDATE SET order_id = ${orderId}, active = true
    `;
  }

  try {
    await addToSubscribers(userEmail, { name: order.user_name, source: "purchase" });
  } catch (e) {
    console.error("Add to subscribers:", e);
  }

  const slugRows = await sql`
    SELECT p.slug FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ${orderId} LIMIT 1
  ` as { slug: string }[];
  const productSlug = slugRows[0]?.slug ?? null;

  try {
    const accessToken = await createAccessToken(userEmail, orderId);
    await sendOrderConfirmation(userEmail, order.user_name || "there", orderId, {
      accessToken,
      productSlug,
    });
    await sql`UPDATE orders SET last_confirmation_email_at = NOW() WHERE id = ${orderId}`;
    console.info("[Fulfillment] Order confirmation email sent to", userEmail, "orderId", orderId);
  } catch (e) {
    console.error("[Fulfillment] Order confirmation email failed:", e instanceof Error ? e.message : e);
    throw e;
  }
}
