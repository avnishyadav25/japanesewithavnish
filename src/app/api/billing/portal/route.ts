import { NextResponse } from "next/server";
import Stripe from "stripe";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export async function POST() {
  const session = await getSession();
  if (!session?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!sql) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 });
  }

  const rows = await sql`
    SELECT stripe_customer_id
    FROM profiles
    WHERE email = ${session.email}
    LIMIT 1
  ` as { stripe_customer_id: string | null }[];

  const customerId = rows[0]?.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json({ error: "No Stripe billing account found" }, { status: 404 });
  }

  const stripe = new Stripe(secretKey, { apiVersion: "2023-10-16" as any });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${siteUrl}/billing`,
  });

  return NextResponse.json({ url: portalSession.url });
}
