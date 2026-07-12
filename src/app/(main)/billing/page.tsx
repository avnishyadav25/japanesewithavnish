import Link from "next/link";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

type ProfileRow = {
  email: string;
  premium_until: string | null;
  is_lifetime: boolean | null;
  current_plan: string | null;
  subscription_status: string | null;
  stripe_customer_id: string | null;
};

type SubscriptionRow = {
  id: string;
  provider: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  provider_subscription_id: string | null;
  plan_name: string;
  plan_slug: string;
  billing_type: string;
};

type PaymentRow = {
  id: string;
  provider: string;
  provider_payment_id: string | null;
  provider_invoice_id: string | null;
  amount: number;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  plan_name: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function getDaysLeft(value: string | null) {
  if (!value) return 0;
  const diff = new Date(value).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function formatMoney(amount: number, currency: string) {
  if (currency === "USD") return `$${(amount / 100).toFixed(2)}`;
  return `₹${(amount / 100).toLocaleString("en-IN")}`;
}

export const metadata = {
  title: "Billing | Japanese with Avnish",
};

export default async function BillingPage() {
  const session = await getSession();
  if (!session?.email) {
    return (
      <div className="min-h-screen bg-[var(--base)] py-12 px-4">
        <div className="max-w-[640px] mx-auto rounded-3xl border border-[var(--divider)] bg-white p-6 sm:p-8 shadow-sm text-center">
          <h1 className="font-heading text-2xl font-black text-charcoal mb-2">Billing</h1>
          <p className="text-secondary mb-6">Please log in to view your Premium Pass, billing history, and renewal options.</p>
          <Link href="/login?redirect=/billing" className="btn-primary inline-block">Log in</Link>
        </div>
      </div>
    );
  }

  if (!sql) {
    return (
      <div className="min-h-screen bg-[var(--base)] py-12 px-4">
        <div className="max-w-[720px] mx-auto rounded-3xl border border-[var(--divider)] bg-white p-6 sm:p-8">
          <h1 className="font-heading text-2xl font-black text-charcoal mb-2">Billing unavailable</h1>
          <p className="text-secondary">Database access is not configured.</p>
        </div>
      </div>
    );
  }

  const profileRows = await sql`
      SELECT email, premium_until::text, is_lifetime, current_plan, subscription_status, stripe_customer_id
      FROM profiles
      WHERE email = ${session.email}
      LIMIT 1
    ` as ProfileRow[];
  const subscriptionRows = await sql`
      SELECT
        us.id,
        us.provider,
        us.status,
        us.current_period_start::text,
        us.current_period_end::text,
        us.cancel_at_period_end,
        us.provider_subscription_id,
        sp.name AS plan_name,
        sp.slug AS plan_slug,
        sp.billing_type
      FROM user_subscriptions us
      JOIN subscription_plans sp ON sp.id = us.plan_id
      WHERE us.user_email = ${session.email}
      ORDER BY us.created_at DESC
      LIMIT 5
    ` as SubscriptionRow[];
  const paymentRows = await sql`
      SELECT
        spay.id,
        spay.provider,
        spay.provider_payment_id,
        spay.provider_invoice_id,
        spay.amount,
        spay.currency,
        spay.status,
        spay.paid_at::text,
        spay.created_at::text,
        plans.name AS plan_name
      FROM subscription_payments spay
      LEFT JOIN subscription_plans plans ON plans.id = spay.plan_id
      WHERE spay.user_email = ${session.email}
      ORDER BY spay.created_at DESC
      LIMIT 10
    ` as PaymentRow[];

  const profile = profileRows[0] || null;
  const activeSubscription = subscriptionRows[0] || null;
  const isLifetime = Boolean(profile?.is_lifetime);
  const premiumUntil = profile?.premium_until || activeSubscription?.current_period_end || null;
  const daysLeft = isLifetime ? null : getDaysLeft(premiumUntil);
  const hasRazorpayPass = subscriptionRows.some((row) => row.provider === "razorpay");

  return (
    <div className="min-h-screen bg-[var(--base)] py-8 sm:py-12 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <section className="rounded-3xl border border-[var(--divider)] bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-primary mb-2">Billing</p>
              <h1 className="font-heading text-3xl font-black text-charcoal">Premium Pass</h1>
              <p className="text-secondary mt-2 max-w-2xl">
                View your active access, renewal options, and payment history for Japanese with Avnish.
              </p>
            </div>
            <Link href="/pricing" className="btn-secondary text-center">Renew or upgrade</Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-[var(--divider)] bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-widest text-secondary">Current status</p>
            <p className="font-heading text-2xl font-black text-charcoal mt-2">
              {isLifetime ? "Lifetime" : daysLeft && daysLeft > 0 ? "Active" : "Free"}
            </p>
            <p className="text-sm text-secondary mt-1">{profile?.subscription_status || activeSubscription?.status || "No active pass"}</p>
          </div>
          <div className="rounded-3xl border border-[var(--divider)] bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-widest text-secondary">Access left</p>
            <p className="font-heading text-2xl font-black text-charcoal mt-2">
              {isLifetime ? "Forever" : `${daysLeft} days`}
            </p>
            <p className="text-sm text-secondary mt-1">{isLifetime ? "Lifetime access" : `Expires ${formatDate(premiumUntil)}`}</p>
          </div>
          <div className="rounded-3xl border border-[var(--divider)] bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-widest text-secondary">Billing provider</p>
            <p className="font-heading text-2xl font-black text-charcoal mt-2">
              {hasRazorpayPass ? "Razorpay" : "None"}
            </p>
            <p className="text-sm text-secondary mt-1">
              {hasRazorpayPass ? "One-time fixed-duration pass" : "Free plan"}
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-[var(--divider)] bg-white p-6 shadow-sm">
            <h2 className="font-heading text-xl font-black text-charcoal mb-4">Manage billing</h2>
            <div className="space-y-4">
              <p className="text-secondary text-sm leading-relaxed">
                Razorpay Premium Passes are one-time purchases. You can renew early; new monthly or yearly pass days are added on top of your current remaining access.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/pricing" className="btn-primary text-center">Advance renew</Link>
                <Link href="/pricing" className="btn-secondary text-center">Change pass</Link>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[var(--divider)] bg-white p-6 shadow-sm">
            <h2 className="font-heading text-xl font-black text-charcoal mb-4">Latest pass</h2>
            {activeSubscription ? (
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-secondary">Plan</dt>
                  <dd className="font-bold text-charcoal text-right">{activeSubscription.plan_name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-secondary">Provider</dt>
                  <dd className="font-bold text-charcoal capitalize">{activeSubscription.provider === "stripe" ? "legacy" : activeSubscription.provider}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-secondary">Period end</dt>
                  <dd className="font-bold text-charcoal">{formatDate(activeSubscription.current_period_end)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-secondary">Renewal</dt>
                  <dd className="font-bold text-charcoal text-right">
                    Manual renewal
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-secondary text-sm">No Premium Pass purchase yet.</p>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-[var(--divider)] bg-white p-4 sm:p-6 shadow-sm overflow-hidden">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
            <h2 className="font-heading text-xl font-black text-charcoal">Billing history</h2>
            <Link href="/contact" className="text-primary text-sm font-bold hover:underline">Need help?</Link>
          </div>
          {paymentRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-secondary border-b border-[var(--divider)]">
                    <th className="py-3 pr-4">Date</th>
                    <th className="py-3 pr-4">Plan</th>
                    <th className="py-3 pr-4">Provider</th>
                    <th className="py-3 pr-4">Amount</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentRows.map((payment) => (
                    <tr key={payment.id} className="border-b border-[var(--divider)] last:border-0">
                      <td className="py-3 pr-4">{formatDate(payment.paid_at || payment.created_at)}</td>
                      <td className="py-3 pr-4 font-semibold text-charcoal">{payment.plan_name || "Premium Pass"}</td>
                      <td className="py-3 pr-4 capitalize">{payment.provider}</td>
                      <td className="py-3 pr-4 font-bold">{formatMoney(payment.amount, payment.currency)}</td>
                      <td className="py-3 pr-4 capitalize">{payment.status}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-secondary truncate max-w-[180px]">
                        {payment.provider_invoice_id || payment.provider_payment_id || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-secondary text-sm">No billing history yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
