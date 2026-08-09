import { headers } from "next/headers";
import { sql } from "@/lib/db";
import { PricingClient } from "./PricingClient";
import { OfferBannerBar } from "@/components/OfferBannerBar";
import { canonicalUrl } from "@/lib/seo";

const TITLE = "Pricing | Japanese with Avnish";
const DESCRIPTION = "Get unlimited access to structured Japanese learning paths from N5 to N1 with premium plans.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/pricing" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: canonicalUrl("/pricing"), type: "website", images: ["/og-default.png"] },
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

  return (
    <>
      <OfferBannerBar />
      <PricingClient plans={plans as any} defaultCurrency={defaultCurrency} />
    </>
  );
}
