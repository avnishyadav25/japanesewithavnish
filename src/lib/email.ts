import { Resend } from "resend";
import {
  emailWrapper,
  welcomeNewsletterContent,
  newCommentNotificationContent,
  communityGuidelinesContent,
  newsletterContent,
  productListHtml,
  type EmailProduct,
} from "./email-templates";
import { createAdminClient } from "@/lib/supabase/admin";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = process.env.EMAIL_FROM || "Japanese with Avnish <noreply@japanesewithavnish.com>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";

async function getProductsForEmail(): Promise<EmailProduct[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("products")
      .select("slug, name, price_paise, image_url, jlpt_level")
      .order("sort_order", { ascending: true })
      .limit(6);
    return (data || []) as EmailProduct[];
  } catch {
    return [];
  }
}

export async function sendMagicLink(email: string, magicLinkUrl: string) {
  if (!resend) return null;
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Login to Japanese with Avnish",
    html: `
      <p>Click the link below to access your library:</p>
      <p><a href="${magicLinkUrl}" style="color:#D0021B;font-weight:600;">Access My Library</a></p>
      <p>This link expires in 1 hour.</p>
      <p>If you didn't request this, you can ignore this email.</p>
    `,
  });
  if (error) throw error;
  return data;
}

export async function sendOrderConfirmation(
  email: string,
  name: string,
  libraryUrl: string,
  orderId: string
) {
  if (!resend) return null;
  const content = `
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi ${name},</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Thank you for your purchase! Your digital bundle is ready.</p>
    <p style="margin:0 0 24px;"><a href="${libraryUrl}" style="background:#D0021B;color:white;padding:12px 26px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;">Access My Library</a></p>
    <p style="font-size:14px;line-height:1.6;margin:0;color:#555;">Order ID: ${orderId}</p>
    <p style="font-size:14px;line-height:1.6;margin:8px 0 0;color:#555;">You can access your downloads anytime by logging in with this email.</p>
    <p style="font-size:14px;line-height:1.6;margin:16px 0 0;">— Japanese with Avnish</p>
  `;
  const products = await getProductsForEmail();
  const productList = productListHtml(products, SITE_URL);
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Your purchase is ready — Japanese with Avnish",
    html: emailWrapper(content, productList),
  });
  if (error) throw error;
  return data;
}

export async function sendQuizResults(
  email: string,
  level: string,
  recommendedBundle: string,
  productUrl: string
) {
  if (!resend) return null;
  const content = `
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Based on your quiz results, we recommend the <strong>${level}</strong> level.</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Your best fit: <strong>${recommendedBundle}</strong></p>
    <p style="margin:0 0 24px;"><a href="${productUrl}" style="background:#D0021B;color:white;padding:12px 26px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;">Get Your Bundle</a></p>
    <p style="font-size:14px;line-height:1.6;margin:0;color:#555;">— Japanese with Avnish</p>
  `;
  const products = await getProductsForEmail();
  const productList = productListHtml(products, SITE_URL);
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Your JLPT level: ${level} — Japanese with Avnish`,
    html: emailWrapper(content, productList),
  });
  if (error) throw error;
  return data;
}

export async function sendWelcomeNewsletter(email: string, name?: string) {
  if (!resend) return null;
  const content = welcomeNewsletterContent(name || "");
  const products = await getProductsForEmail();
  const productList = productListHtml(products, SITE_URL);
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Welcome to Japanese with Avnish — JLPT tips & updates",
    html: emailWrapper(content, productList),
  });
  if (error) throw error;
  return data;
}

export async function sendNewsletter(
  email: string,
  name: string | undefined,
  subject: string,
  htmlContent: string
) {
  if (!resend) return null;
  const content = newsletterContent(htmlContent);
  const products = await getProductsForEmail();
  const productList = productListHtml(products, SITE_URL);
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject,
    html: emailWrapper(content, productList),
  });
  if (error) throw error;
  return data;
}

export async function sendNewCommentNotification(
  email: string,
  name: string,
  postTitle: string,
  postUrl: string,
  commenterName: string,
  commentPreview: string
) {
  if (!resend) return null;
  const content = newCommentNotificationContent(
    name,
    postTitle,
    postUrl,
    commenterName,
    commentPreview
  );
  const products = await getProductsForEmail();
  const productList = productListHtml(products, SITE_URL);
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `New comment on "${postTitle}" — Japanese with Avnish`,
    html: emailWrapper(content, productList),
  });
  if (error) throw error;
  return data;
}

export async function sendCommunityGuidelinesEmail(
  email: string,
  name: string,
  postTitle: string,
  postUrl: string
) {
  if (!resend) return null;
  const content = communityGuidelinesContent(name, postTitle, postUrl);
  const products = await getProductsForEmail();
  const productList = productListHtml(products, SITE_URL);
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Community guidelines — Japanese with Avnish`,
    html: emailWrapper(content, productList),
  });
  if (error) throw error;
  return data;
}
