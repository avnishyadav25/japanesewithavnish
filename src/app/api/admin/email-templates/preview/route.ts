import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import {
  emailWrapper,
  welcomeNewsletterContent,
  newCommentNotificationContent,
  communityGuidelinesContent,
  productListHtml,
  type EmailProduct,
} from "@/lib/email-templates";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";

export async function GET(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  try {
    let products: EmailProduct[] = [];
    if (sql) {
      const rows = await sql`SELECT slug, name, price_paise, image_url, jlpt_level FROM products ORDER BY sort_order ASC LIMIT 6`;
      products = (rows || []) as EmailProduct[];
    }
    const productList = productListHtml(products, SITE_URL);

    let content = "";
    switch (type) {
      case "welcome-newsletter":
        content = welcomeNewsletterContent("Alex");
        break;
      case "order-confirmation": {
        const libUrl = `${SITE_URL}/library`;
        content = `
          <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi Alex,</p>
          <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Thank you for your purchase! Your digital bundle is ready.</p>
          <p style="margin:0 0 24px;"><a href="${libUrl}" style="background:#D0021B;color:white;padding:12px 26px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;">Access Store</a></p>
          <p style="font-size:14px;line-height:1.6;margin:0;color:#555;">Order ID: ord_abc123</p>
          <p style="font-size:14px;line-height:1.6;margin:8px 0 0;color:#555;">You can access your downloads anytime by logging in with this email.</p>
          <p style="font-size:14px;line-height:1.6;margin:16px 0 0;">— Japanese with Avnish</p>
        `;
        break;
      }
      case "quiz-results": {
        const productUrl = `${SITE_URL}/product/japanese-n5-mastery-bundle`;
        content = `
          <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Based on your quiz results, we recommend the <strong>N5</strong> level.</p>
          <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Your best fit: <strong>Japanese N5 Mastery Bundle</strong></p>
          <p style="margin:0 0 24px;"><a href="${productUrl}" style="background:#D0021B;color:white;padding:12px 26px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;">Get Your Bundle</a></p>
          <p style="font-size:14px;line-height:1.6;margin:0;color:#555;">— Japanese with Avnish</p>
        `;
        break;
      }
      case "new-comment": {
        const postUrl = `${SITE_URL}/blog/jlpt-n5-roadmap`;
        content = newCommentNotificationContent(
          "Alex",
          "JLPT N5 Roadmap: Your Structured Guide to Success",
          postUrl,
          "Priya",
          "This is a great guide! I've been following the 12-week schedule and it's really helping me stay on track."
        );
        break;
      }
      case "community-guidelines": {
        const postUrl = `${SITE_URL}/blog/jlpt-n5-roadmap`;
        content = communityGuidelinesContent(
          "Alex",
          "JLPT N5 Roadmap: Your Structured Guide to Success",
          postUrl
        );
        break;
      }
      case "magic-link": {
        const magicUrl = `${SITE_URL}/library?token=sample`;
        return new NextResponse(
          `<!DOCTYPE html><html><body style="font-family:system-ui;padding:24px;">
            <p>Click the link below to access your library:</p>
            <p><a href="${magicUrl}" style="color:#D0021B;font-weight:600;">Access Store</a></p>
            <p>This link expires in 1 hour.</p>
            <p>If you didn't request this, you can ignore this email.</p>
          </body></html>`,
          { headers: { "Content-Type": "text/html; charset=utf-8" } }
        );
      }
      default:
        return NextResponse.json({ error: "Invalid template type" }, { status: 400 });
    }

    const html = emailWrapper(content, productList);
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e) {
    console.error("Email template preview:", e);
    return NextResponse.json({ error: "Failed to generate preview" }, { status: 500 });
  }
}
