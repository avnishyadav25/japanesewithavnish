import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { CopyUpiButton } from "./CopyUpiButton";
import { SubmitPaymentDetailsForm } from "./SubmitPaymentDetailsForm";

const UPI_ID = process.env.NEXT_PUBLIC_UPI_ID || "japanesewithavnish@ybl";
const WHATSAPP_NUMBER = "8960964978";
const CONTACT_EMAIL = "learnjapanesewithavnish@gmail.com";

async function getOrderForPay(orderId: string) {
  if (!sql) return null;
  const rows = await sql`
    SELECT o.id, o.status, o.provider, o.total_amount_paise
    FROM orders o
    WHERE o.id = ${orderId}
    LIMIT 1
  ` as { id: string; status: string; provider: string; total_amount_paise: number }[];
  const order = rows[0];
  if (!order || order.status !== "pending_payment") return null;
  const productRows = await sql`
    SELECT p.name FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ${orderId}
    LIMIT 1
  ` as { name: string }[];
  return {
    orderId: order.id,
    amountPaise: order.total_amount_paise,
    productName: productRows[0]?.name ?? "Order",
  };
}

export default async function OrderPayPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const order = await getOrderForPay(orderId);
  if (!order) notFound();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";
  const payPageUrl = `${siteUrl}/order/${orderId}/pay`;
  const whatsappUrl = `https://wa.me/91${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Payment page link: ${payPageUrl}`)}`;

  return (
    <div className="bg-[#FAF8F5] py-12 sm:py-16 px-4 sm:px-6">
      <div className="max-w-[600px] mx-auto space-y-8">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-charcoal text-center">
          Complete your payment
        </h1>

        <p className="text-secondary text-sm">
          You were redirected here after placing your order. Bookmark this page or copy the link below to return after payment.
        </p>
        <p className="text-sm">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary font-medium underline"
          >
            Get this link on WhatsApp
          </a>
          {" — "}
          <span className="text-secondary">opens WhatsApp so you can save the payment page link.</span>
        </p>

        <div className="card p-6 space-y-4">
          <p className="text-lg font-semibold text-charcoal">
            Amount for {order.productName}: ₹{(order.amountPaise ?? 0) / 100}
          </p>
          <p className="text-sm text-secondary">Order ID: <span className="font-mono font-medium text-charcoal">{order.orderId}</span></p>
        </div>

        <div className="card p-6 space-y-4">
          <p className="font-semibold text-charcoal">Pay via UPI ID</p>
          <div className="flex items-center gap-3 flex-wrap">
            <code className="text-lg font-mono bg-[var(--divider)] px-3 py-2 rounded-bento">{UPI_ID}</code>
            <CopyUpiButton upiId={UPI_ID} />
          </div>
        </div>

        <div className="flex flex-col items-center">
          <p className="text-sm text-secondary mb-2">Or scan this QR code with your UPI app</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/upi-qr.png"
            alt="Scan to pay via UPI"
            className="w-48 h-48 object-contain border border-[var(--divider)] rounded-bento"
          />
        </div>

        <div className="card p-6 bg-primary/10 border-2 border-primary/30 space-y-3">
          <p className="font-semibold text-charcoal">
            After payment, send your <strong>payment screenshot with product name</strong> to us via:
          </p>
          <ul className="list-disc list-inside text-secondary space-y-1">
            <li>
              <a href={`https://wa.me/91${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer" className="text-primary font-medium underline">
                WhatsApp (8960964978)
              </a>
            </li>
            <li>
              <a href="https://www.instagram.com/japanesewithavnish" target="_blank" rel="noopener noreferrer" className="text-primary font-medium underline">
                Instagram (@japanesewithavnish)
              </a>
            </li>
            <li>
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary font-medium underline">
                {CONTACT_EMAIL}
              </a>
            </li>
          </ul>
          <p className="font-medium text-charcoal pt-2">
            You will receive confirmation email within 10–20 minutes after we verify your payment.
          </p>
        </div>

        <SubmitPaymentDetailsForm orderId={orderId} />
      </div>
    </div>
  );
}
