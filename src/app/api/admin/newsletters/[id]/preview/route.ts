import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { emailWrapper } from "@/lib/email-templates";
import { getProductsForEmail } from "@/lib/email";
import { productListHtml } from "@/lib/email-templates";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return new NextResponse("Unauthorized", { status: 401 });
  if (!sql) return new NextResponse("Service unavailable", { status: 503 });
  const { id } = await params;
  const rows = await sql`
    SELECT subject, body_html FROM newsletters WHERE id = ${id} LIMIT 1
  ` as { subject: string; body_html: string }[];
  const newsletter = rows[0];
  if (!newsletter) return new NextResponse("Not found", { status: 404 });
  const products = await getProductsForEmail();
  const productList = productListHtml(products, SITE_URL);
  const html = emailWrapper(newsletter.body_html, productList);
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
