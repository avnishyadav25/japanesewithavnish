import nodemailer from "nodemailer";
import {
  emailWrapper,
  welcomeNewsletterContent,
  newCommentNotificationContent,
  communityGuidelinesContent,
  newsletterContent,
  productListHtml,
  type EmailProduct,
} from "./email-templates";
import { sql } from "@/lib/db";
import { getDriveUrlForSlug } from "@/lib/drive-url";

const FROM_EMAIL = process.env.EMAIL_FROM || "Japanese with Avnish <noreply@japanesewithavnish.com>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";

function getTransporter(): nodemailer.Transporter | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  const port = Number(process.env.SMTP_PORT) || 587;
  // Port 465 = implicit SSL (secure: true). Port 587 = STARTTLS (secure: false). Wrong version number = usually secure:true on 587.
  const secure = port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
}

async function sendMail(to: string, subject: string, html: string): Promise<{ id?: string } | null> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("[Email] SMTP not configured (SMTP_HOST missing). Skipping send.");
    return null;
  }
  try {
    const info = await transporter.sendMail({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });
    return { id: info.messageId };
  } catch (err) {
    console.error("[Email] Send failed:", err instanceof Error ? err.message : String(err));
    throw err;
  }
}

export async function getProductsForEmail(): Promise<EmailProduct[]> {
  try {
    if (!sql) return [];
    const rows = await sql`SELECT slug, name, price_paise, image_url, jlpt_level FROM products ORDER BY sort_order ASC LIMIT 6`;
    return (rows || []) as EmailProduct[];
  } catch {
    return [];
  }
}

export async function sendMagicLink(email: string, magicLinkUrl: string) {
  return sendMail(
    email,
    "Login to Japanese with Avnish",
    `
      <p>Click the link below to access your library:</p>
      <p><a href="${magicLinkUrl}" style="color:#D0021B;font-weight:600;">Access Store</a></p>
      <p>This link expires in 1 hour.</p>
      <p>If you didn't request this, you can ignore this email.</p>
    `
  );
}

export type OrderConfirmationOptions = {
  accessToken: string;
  productSlug?: string | null;
};

export async function sendOrderConfirmation(
  email: string,
  name: string,
  orderId: string,
  options: OrderConfirmationOptions
) {
  const { accessToken, productSlug } = options;
  const libraryUrl = `${SITE_URL}/access?token=${accessToken}`;
  const driveUrl = productSlug ? getDriveUrlForSlug(productSlug) : null;
  const accessUrl = driveUrl || libraryUrl;
  const orderDetailUrl = `${SITE_URL}/order/${orderId}?token=${accessToken}`;

  const content = `
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi ${name},</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Thank you for your purchase! Your digital bundle is ready.</p>
    <p style="margin:0 0 16px;"><a href="${accessUrl}" style="background:#D0021B;color:white;padding:12px 26px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;">Access Store</a></p>
    <p style="margin:0 0 16px;"><a href="${orderDetailUrl}" style="color:#D0021B;font-weight:600;">View order details</a></p>
    <p style="font-size:14px;line-height:1.6;margin:0;color:#555;">Order ID: ${orderId}</p>
    <p style="font-size:14px;line-height:1.6;margin:8px 0 0;color:#555;">You can return to your library anytime using the link above (it stays valid for 30 days).</p>
    <p style="font-size:14px;line-height:1.6;margin:16px 0 0;">— Japanese with Avnish</p>
  `;
  const products = await getProductsForEmail();
  const productList = productListHtml(products, SITE_URL);
  return sendMail(email, "Your purchase is ready — Japanese with Avnish", emailWrapper(content, productList));
}

export async function sendQuizResults(
  email: string,
  level: string,
  recommendedBundle: string,
  productUrl: string
) {
  const content = `
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Based on your quiz results, we recommend the <strong>${level}</strong> level.</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Your best fit: <strong>${recommendedBundle}</strong></p>
    <p style="margin:0 0 24px;"><a href="${productUrl}" style="background:#D0021B;color:white;padding:12px 26px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;">Get Your Bundle</a></p>
    <p style="font-size:14px;line-height:1.6;margin:0;color:#555;">— Japanese with Avnish</p>
  `;
  const products = await getProductsForEmail();
  const productList = productListHtml(products, SITE_URL);
  return sendMail(email, `Your JLPT level: ${level} — Japanese with Avnish`, emailWrapper(content, productList));
}

export async function sendWelcomeNewsletter(email: string, name?: string) {
  const content = welcomeNewsletterContent(name || "");
  const products = await getProductsForEmail();
  const productList = productListHtml(products, SITE_URL);
  return sendMail(email, "Welcome to Japanese with Avnish — JLPT tips & updates", emailWrapper(content, productList));
}

export async function sendNewsletter(
  email: string,
  name: string | undefined,
  subject: string,
  htmlContent: string
) {
  const content = newsletterContent(htmlContent);
  const products = await getProductsForEmail();
  const productList = productListHtml(products, SITE_URL);
  return sendMail(email, subject, emailWrapper(content, productList));
}

export async function sendNewCommentNotification(
  email: string,
  name: string,
  postTitle: string,
  postUrl: string,
  commenterName: string,
  commentPreview: string
) {
  const content = newCommentNotificationContent(
    name,
    postTitle,
    postUrl,
    commenterName,
    commentPreview
  );
  const products = await getProductsForEmail();
  const productList = productListHtml(products, SITE_URL);
  return sendMail(
    email,
    `New comment on "${postTitle}" — Japanese with Avnish`,
    emailWrapper(content, productList)
  );
}

export async function sendCommunityGuidelinesEmail(
  email: string,
  name: string,
  postTitle: string,
  postUrl: string
) {
  const content = communityGuidelinesContent(name, postTitle, postUrl);
  const products = await getProductsForEmail();
  const productList = productListHtml(products, SITE_URL);
  return sendMail(email, "Community guidelines — Japanese with Avnish", emailWrapper(content, productList));
}

/** Sent when a payment fails (e.g. Razorpay payment.failed). Includes product link to retry. */
export async function sendPaymentFailedRetryEmail(
  email: string,
  name: string,
  productUrl: string,
  productName?: string
) {
  const productLabel = productName || "your bundle";
  const content = `
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi ${name},</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Your recent payment didn&apos;t go through. This can happen if the card was declined, insufficient funds, or the payment was cancelled.</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">You can try again anytime using the link below:</p>
    <p style="margin:0 0 24px;"><a href="${productUrl}" style="background:#D0021B;color:white;padding:12px 26px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;">Retry payment — ${productLabel}</a></p>
    <p style="font-size:14px;line-height:1.6;margin:0;color:#555;">If you need help or want to use a different payment method, reply to this email or contact us using the link in the footer.</p>
    <p style="font-size:14px;line-height:1.6;margin:16px 0 0;">— Japanese with Avnish</p>
  `;
  const products = await getProductsForEmail();
  const productList = productListHtml(products, SITE_URL);
  return sendMail(
    email,
    "Payment didn't go through — try again — Japanese with Avnish",
    emailWrapper(content, productList)
  );
}
