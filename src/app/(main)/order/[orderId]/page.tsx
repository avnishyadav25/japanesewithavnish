import "server-only";
import Link from "next/link";
import { verifyAccessToken } from "@/lib/access-tokens";
import { getDriveUrlForSlug } from "@/lib/drive-url";
import { sql } from "@/lib/db";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";

type OrderDetail = {
  id: string;
  user_email: string;
  user_name: string | null;
  status: string;
  total_amount_paise: number | null;
  created_at: string | null;
  productSlug: string | null;
  productName: string | null;
};

async function getOrderDetail(orderId: string, email: string): Promise<OrderDetail | null> {
  if (sql) {
    const rows = await sql`
      SELECT o.id, o.user_email, o.user_name, o.status, o.total_amount_paise, o.created_at
      FROM orders o
      WHERE o.id = ${orderId} AND o.user_email = ${email}
      LIMIT 1
    ` as { id: string; user_email: string; user_name: string | null; status: string; total_amount_paise: number | null; created_at: string | null }[];
    const order = rows[0];
    if (!order) return null;
    const slugRows = await sql`
      SELECT p.slug, p.name FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ${orderId}
      LIMIT 1
    ` as { slug: string; name: string }[];
    return {
      ...order,
      productSlug: slugRows[0]?.slug ?? null,
      productName: slugRows[0]?.name ?? null,
    };
  }
  return null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatAmount(paise: number | null): string {
  if (paise == null) return "—";
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { orderId } = await params;
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="bg-[#FAF8F5] py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="bento-grid">
            <div className="bento-span-6 card p-12 text-center">
              <h1 className="font-heading text-2xl font-bold text-charcoal mb-2">
                Order details
              </h1>
              <p className="text-secondary mb-4">
                Use the link from your order confirmation email to view this page.
              </p>
              <Link href="/store" className="btn-primary">
                Browse the store
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const payload = await verifyAccessToken(token);
  if (!payload || payload.orderId !== orderId) {
    return (
      <div className="bg-[#FAF8F5] py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="bento-grid">
            <div className="bento-span-6 card p-12 text-center">
              <h1 className="font-heading text-2xl font-bold text-charcoal mb-2">
                Link invalid or expired
              </h1>
              <p className="text-secondary mb-4">
                This link may have expired. Check your confirmation email for a valid link.
              </p>
              <Link href="/store" className="btn-primary">
                Browse the store
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const order = await getOrderDetail(orderId, payload.email);
  if (!order) {
    return (
      <div className="bg-[#FAF8F5] py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="bento-grid">
            <div className="bento-span-6 card p-12 text-center">
              <h1 className="font-heading text-2xl font-bold text-charcoal mb-2">
                Order not found
              </h1>
              <Link href="/store" className="btn-primary mt-4">
                Browse the store
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const driveUrl = order.productSlug ? getDriveUrlForSlug(order.productSlug) : null;
  const accessUrl = driveUrl || `${SITE_URL}/access?token=${token}`;

  return (
    <div className="bg-[#FAF8F5] py-12 sm:py-16 px-4 sm:px-6">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-6">
          <Link href="/store" className="text-sm text-secondary hover:text-primary">
            ← Back to store
          </Link>
        </div>
        <div className="bento-grid">
          <div className="bento-span-6 card p-8 sm:p-10">
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-charcoal mb-2">
              Order details
            </h1>
            <p className="text-secondary mb-6">
              Order ID: <span className="font-mono text-charcoal">{order.id}</span>
            </p>

            <dl className="space-y-3 text-sm mb-8">
              <div>
                <dt className="text-secondary">Status</dt>
                <dd className="font-medium text-charcoal capitalize">{order.status}</dd>
              </div>
              <div>
                <dt className="text-secondary">Date</dt>
                <dd className="font-medium text-charcoal">{formatDate(order.created_at)}</dd>
              </div>
              <div>
                <dt className="text-secondary">Total</dt>
                <dd className="font-medium text-charcoal">{formatAmount(order.total_amount_paise)}</dd>
              </div>
              {order.productName && (
                <div>
                  <dt className="text-secondary">Product</dt>
                  <dd className="font-medium text-charcoal">{order.productName}</dd>
                </div>
              )}
            </dl>

            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={accessUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary inline-flex justify-center"
              >
                Access My Library
              </a>
              <Link href={`/access?token=${token}`} className="btn-secondary inline-flex justify-center">
                Open library on site
              </Link>
            </div>

            <p className="text-secondary text-sm mt-4">
              Your access link is valid for 30 days. You can return anytime using the link above.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
