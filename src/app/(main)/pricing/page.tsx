import { headers } from "next/headers";
import { sql } from "@/lib/db";
import { PricingClient } from "./PricingClient";

export const metadata = {
  title: "Pricing | Japanese with Avnish",
  description: "Get unlimited access to structured Japanese learning paths from N5 to N1 with premium plans.",
};

export default async function PricingPage() {
  const headersList = await headers();
  const country = headersList.get("x-vercel-ip-country") || "IN";
  const defaultCurrency = country.toUpperCase() === "IN" ? "INR" : "USD";

  const plans = sql
    ? await sql`
        SELECT id, name, slug, billing_type, price_inr, price_usd, features, is_popular, sort_order
        FROM subscription_plans
        WHERE is_active = true
        ORDER BY sort_order
      `
    : [];

  return <PricingClient plans={plans as any} defaultCurrency={defaultCurrency} />;
}
