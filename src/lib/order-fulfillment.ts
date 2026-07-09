import { sql } from "@/lib/db";
import { sendOrderConfirmation } from "@/lib/email";
import { createAccessToken } from "@/lib/access-tokens";
import { addToSubscribers } from "@/lib/subscribers";

/**
 * Mark order as paid, grant entitlements, add to subscribers, and send confirmation email.
 * Idempotent: no-op if order is already paid.
 */
export async function fulfillOrder(
  orderId: string,
  options: { providerPaymentId?: string | null; providerOrderId?: string | null } = {}
): Promise<void> {
  if (!sql) throw new Error("Database not configured");

  const orderRows = await sql`
    SELECT
      o.id,
      o.user_email,
      o.user_name,
      o.status,
      o.plan_id,
      o.total_amount_paise,
      o.provider,
      o.coupon_code,
      p.provider_payment_id,
      p.provider_order_id
    FROM orders o
    LEFT JOIN payments p ON p.order_id = o.id
    WHERE o.id = ${orderId}
    LIMIT 1
  ` as {
    id: string;
    user_email: string;
    user_name: string;
    status: string;
    plan_id: string | null;
    total_amount_paise: number;
    provider: string | null;
    coupon_code: string | null;
    provider_payment_id: string | null;
    provider_order_id: string | null;
  }[];
  const order = orderRows[0];
  if (!order) throw new Error("Order not found");

  const paidRows = await sql`
    UPDATE orders
    SET status = 'paid', updated_at = NOW()
    WHERE id = ${orderId} AND status <> 'paid'
    RETURNING id
  ` as { id: string }[];

  if (paidRows.length === 0) return;

  const providerPaymentId = options.providerPaymentId || order.provider_payment_id || orderId;
  const providerOrderId = options.providerOrderId || order.provider_order_id || null;

  await sql`
    UPDATE payments
    SET status = 'paid',
        provider_payment_id = COALESCE(provider_payment_id, ${providerPaymentId}),
        provider_order_id = COALESCE(provider_order_id, ${providerOrderId}),
        captured_at = COALESCE(captured_at, NOW())
    WHERE order_id = ${orderId}
  `;

  if (order.coupon_code) {
    await sql`
      UPDATE coupons
      SET used_count = COALESCE(used_count, 0) + 1
      WHERE code = ${order.coupon_code}
    `;
  }

  const userEmail = order.user_email;

  // Handle Subscription Plan Fulfillment
  if (order.plan_id) {
    const planRows = await sql`
      SELECT id, slug, name, billing_type FROM subscription_plans WHERE id = ${order.plan_id} LIMIT 1
    ` as { id: string; slug: string; name: string; billing_type: string }[];
    const plan = planRows[0];
    if (plan) {
      const startsAt = new Date();
      let endsAt: Date | null = null;
      let isLifetime = false;
      let subStatus = "active";

      if (plan.billing_type === "monthly") {
        endsAt = new Date();
        endsAt.setDate(endsAt.getDate() + 30);
      } else if (plan.billing_type === "yearly") {
        endsAt = new Date();
        endsAt.setDate(endsAt.getDate() + 365);
      } else if (plan.billing_type === "lifetime") {
        isLifetime = true;
        subStatus = "lifetime";
      }

      // Insert subscription record
      const subRows = await sql`
        INSERT INTO user_subscriptions (user_email, plan_id, status, provider, started_at, current_period_start, current_period_end)
        VALUES (${userEmail}, ${plan.id}, ${subStatus}, ${order.provider || 'razorpay'}, ${startsAt.toISOString()}, ${startsAt.toISOString()}, ${endsAt ? endsAt.toISOString() : null})
        RETURNING id
      ` as { id: string }[];
      const subId = subRows[0]?.id;

      // Log subscription payment
      await sql`
        INSERT INTO subscription_payments (user_email, subscription_id, plan_id, provider, provider_payment_id, provider_order_id, amount, status, paid_at)
        VALUES (${userEmail}, ${subId}, ${plan.id}, ${order.provider || 'razorpay'}, ${providerPaymentId}, ${providerOrderId}, ${order.total_amount_paise || 0}, 'paid', NOW())
        ON CONFLICT (provider_payment_id) DO NOTHING
      `;

      // Update student profile with subscription cache
      if (isLifetime) {
        await sql`
          UPDATE profiles
          SET is_lifetime = true,
              role = 'premium_student',
              current_plan = ${plan.slug},
              subscription_status = ${subStatus},
              updated_at = NOW()
          WHERE email = ${userEmail}
        `;
      } else {
        const daysToAdd = plan.billing_type === "monthly" ? 30 : 365;
        await sql`
          UPDATE profiles
          SET premium_until = GREATEST(COALESCE(premium_until, NOW()), NOW()) + ${daysToAdd} * INTERVAL '1 day',
              role = 'premium_student',
              current_plan = ${plan.slug},
              subscription_status = ${subStatus},
              updated_at = NOW()
          WHERE email = ${userEmail}
        `;
      }
    }
  }

  const items = await sql`SELECT product_id FROM order_items WHERE order_id = ${orderId}` as { product_id: string | null }[];

  for (const item of items) {
    if (!item.product_id) continue;
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
  }
}
