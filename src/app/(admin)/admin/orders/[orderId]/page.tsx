import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ResendOrderEmailButton } from "@/components/admin/ResendOrderEmailButton";
import { MarkAsPaidButton } from "@/components/admin/MarkAsPaidButton";

type OrderRow = {
  id: string;
  user_email: string;
  user_name: string | null;
  user_phone: string | null;
  status: string;
  provider: string | null;
  total_amount_paise: number;
  coupon_code: string | null;
  discount_paise: number;
  created_at: string;
  updated_at: string;
  last_confirmation_email_at: string | null;
  payment_reference: string | null;
  payment_note: string | null;
};

type OrderItemRow = {
  id: string;
  product_id: string;
  product_name: string;
  product_slug: string;
  quantity: number;
  price_paise: number;
};

type PaymentRow = {
  id: string;
  provider_payment_id: string | null;
  status: string;
  created_at: string;
};

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  if (!sql) notFound();

  const orderRows = await sql`
    SELECT id, user_email, user_name, user_phone, status, provider, total_amount_paise, coupon_code, discount_paise, created_at, updated_at, last_confirmation_email_at, payment_reference, payment_note
    FROM orders WHERE id = ${orderId} LIMIT 1
  ` as OrderRow[];
  const order = orderRows[0];
  if (!order) notFound();

  const itemRows = await sql`
    SELECT oi.id, oi.product_id, p.name AS product_name, p.slug AS product_slug, oi.quantity, oi.price_paise
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ${orderId}
    ORDER BY oi.created_at
  ` as OrderItemRow[];

  const paymentRows = await sql`
    SELECT id, provider_payment_id, status, created_at
    FROM payments WHERE order_id = ${orderId} ORDER BY created_at DESC
  ` as PaymentRow[];

  const statusVariant =
    order.status === "paid"
      ? "paid"
      : order.status === "pending_payment" || order.status === "created"
        ? "pending"
        : order.status === "failed"
          ? "failed"
          : "created";

  const shortId = order.id.slice(0, 8);

  return (
    <div>
      <AdminPageHeader
        title={`Order ${shortId}`}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Orders", href: "/admin/orders" },
          { label: shortId },
        ]}
      />

      <div className="space-y-6">
        <AdminCard>
          <h2 className="font-semibold text-charcoal mb-3">Order info</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-secondary">Order ID</dt>
            <dd className="font-mono text-xs break-all">{order.id}</dd>
            <dt className="text-secondary">Email</dt>
            <dd>{order.user_email}</dd>
            <dt className="text-secondary">Name</dt>
            <dd>{order.user_name ?? "—"}</dd>
            <dt className="text-secondary">Phone</dt>
            <dd>{order.user_phone ?? "—"}</dd>
            <dt className="text-secondary">Status</dt>
            <dd>
              <StatusBadge status={order.status} variant={statusVariant} />
            </dd>
            <dt className="text-secondary">Provider</dt>
            <dd>{order.provider ?? "—"}</dd>
            <dt className="text-secondary">Total</dt>
            <dd>₹{Number(order.total_amount_paise) / 100}</dd>
            <dt className="text-secondary">Discount</dt>
            <dd>{order.discount_paise ? `₹${order.discount_paise / 100}` : "—"}</dd>
            <dt className="text-secondary">Coupon</dt>
            <dd>{order.coupon_code ?? "—"}</dd>
            <dt className="text-secondary">Created</dt>
            <dd>{new Date(order.created_at).toLocaleString()}</dd>
            <dt className="text-secondary">Resend access email</dt>
            <dd>
              <ResendOrderEmailButton
                orderId={order.id}
                lastConfirmationEmailAt={order.last_confirmation_email_at}
              />
            </dd>
            {order.status === "pending_payment" && order.provider === "manual" && (
              <>
                <dt className="text-secondary">Mark as paid (manual UPI)</dt>
                <dd>
                  <MarkAsPaidButton orderId={order.id} />
                </dd>
              </>
            )}
            {order.payment_reference && (
              <>
                <dt className="text-secondary">Payment reference (UTR)</dt>
                <dd className="font-mono text-xs">{order.payment_reference}</dd>
              </>
            )}
            {order.payment_note && (
              <>
                <dt className="text-secondary">Payment note</dt>
                <dd className="text-xs">{order.payment_note}</dd>
              </>
            )}
          </dl>
        </AdminCard>

        <AdminCard>
          <h2 className="font-semibold text-charcoal mb-3">Line items</h2>
          {itemRows.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--divider)] text-left text-secondary">
                  <th className="py-2 pr-2">Product</th>
                  <th className="py-2 pr-2">Qty</th>
                  <th className="py-2 pr-2">Price</th>
                  <th className="py-2 pr-2">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {itemRows.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--divider)]">
                    <td className="py-2 pr-2">
                      <Link
                        href={`/admin/products/${row.product_id}/edit`}
                        className="text-primary hover:underline"
                      >
                        {row.product_name}
                      </Link>
                      <span className="text-secondary text-xs ml-1">/{row.product_slug}</span>
                    </td>
                    <td className="py-2 pr-2">{row.quantity}</td>
                    <td className="py-2 pr-2">₹{row.price_paise / 100}</td>
                    <td className="py-2 pr-2">₹{(row.quantity * row.price_paise) / 100}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-secondary text-sm">No items.</p>
          )}
        </AdminCard>

        <AdminCard>
          <h2 className="font-semibold text-charcoal mb-3">Payments</h2>
          {paymentRows.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--divider)] text-left text-secondary">
                  <th className="py-2 pr-2">Provider payment ID</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 pr-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {paymentRows.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--divider)]">
                    <td className="py-2 pr-2 font-mono text-xs">{p.provider_payment_id ?? "—"}</td>
                    <td className="py-2 pr-2">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="py-2 pr-2 text-secondary">
                      {new Date(p.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-secondary text-sm">No payment records.</p>
          )}
        </AdminCard>
      </div>
    </div>
  );
}
