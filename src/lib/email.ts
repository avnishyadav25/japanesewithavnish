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
import { renderDbEmailTemplate } from "@/lib/email-template-db";

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
  const dbTemplate = await renderDbEmailTemplate("magic-link", { magicLinkUrl });
  if (dbTemplate) return sendMail(email, dbTemplate.subject, dbTemplate.bodyHtml);
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

export async function sendCreatePasswordEmail(email: string, resetLink: string) {
  const content = `
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi there,</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Your Premium access is active. Your account doesn't have a password yet — set one now so you can log in directly next time, instead of only via email links.</p>
    <p style="margin:0 0 20px;"><a href="${resetLink}" style="background:#D0021B;color:white;padding:12px 26px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:700;">Create your password</a></p>
    <p style="font-size:14px;line-height:1.6;margin:0 0 12px;color:#555;">This secure link expires in 1 hour.</p>
    <p style="font-size:14px;line-height:1.6;margin:18px 0 0;">— Japanese with Avnish</p>
  `;
  return sendMail(
    email,
    "Create your password — Japanese with Avnish",
    emailWrapper(content, "")
  );
}

export async function sendPasswordResetEmail(email: string, resetLink: string) {
  const content = `
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi there,</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">We received a request to reset the password for your Japanese with Avnish account.</p>
    <p style="margin:0 0 20px;"><a href="${resetLink}" style="background:#D0021B;color:white;padding:12px 26px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:700;">Reset your password</a></p>
    <p style="font-size:14px;line-height:1.6;margin:0 0 12px;color:#555;">This secure link expires in 1 hour.</p>
    <p style="font-size:14px;line-height:1.6;margin:0;color:#555;">If you did not request this, you can ignore this email. Your password will not change.</p>
    <p style="font-size:14px;line-height:1.6;margin:18px 0 0;">— Japanese with Avnish</p>
  `;
  return sendMail(
    email,
    "Reset your password — Japanese with Avnish",
    emailWrapper(content, "")
  );
}

export async function sendEmailVerificationEmail(email: string, verifyLink: string, name?: string | null) {
  const displayName = escapeHtml(name?.trim() || "there");
  const content = `
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi ${displayName},</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Welcome to Japanese with Avnish. Please verify your email so we know where to send account and learning updates.</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Your free account includes 2 lessons daily. Premium passes unlock unlimited lessons whenever you are ready.</p>
    <p style="margin:0 0 20px;"><a href="${verifyLink}" style="background:#D0021B;color:white;padding:12px 26px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:700;">Verify email address</a></p>
    <p style="font-size:14px;line-height:1.6;margin:0;color:#555;">This link expires in 24 hours. If you did not create this account, you can ignore this email.</p>
    <p style="font-size:14px;line-height:1.6;margin:18px 0 0;">— Japanese with Avnish</p>
  `;
  return sendMail(email, "Verify your email — Japanese with Avnish", emailWrapper(content, ""));
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

  const products = await getProductsForEmail();
  const productList = productListHtml(products, SITE_URL);

  const dbTemplate = await renderDbEmailTemplate("order-confirmation", { name, accessUrl, orderDetailUrl, orderId });
  if (dbTemplate) return sendMail(email, dbTemplate.subject, emailWrapper(dbTemplate.bodyHtml, productList));

  const content = `
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi ${name},</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Thank you for your purchase! Your access is ready.</p>
    <p style="margin:0 0 16px;"><a href="${accessUrl}" style="background:#D0021B;color:white;padding:12px 26px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;">Access your content</a></p>
    <p style="margin:0 0 16px;"><a href="${orderDetailUrl}" style="color:#D0021B;font-weight:600;">View order details</a></p>
    <p style="font-size:14px;line-height:1.6;margin:0;color:#555;">Order ID: ${orderId}</p>
    <p style="font-size:14px;line-height:1.6;margin:8px 0 0;color:#555;">You can return to your library anytime using the link above (it stays valid for 30 days).</p>
    <p style="font-size:14px;line-height:1.6;margin:16px 0 0;">— Japanese with Avnish</p>
  `;
  return sendMail(email, "Your purchase is ready — Japanese with Avnish", emailWrapper(content, productList));
}

export async function sendStreakReminder(email: string, streakDays: number) {
  const loginUrl = `${SITE_URL}/login?redirect=/learn/dashboard`;
  const content = `
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">You're on a <strong>${streakDays}-day</strong> streak. Don't break it — log in and complete today's session.</p>
    <p style="margin:0 0 24px;"><a href="${loginUrl}" style="background:#D0021B;color:white;padding:12px 26px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;">Log in & continue</a></p>
    <p style="font-size:14px;line-height:1.6;margin:0;color:#555;">— Nihongo Navi / Japanese with Avnish</p>
  `;
  return sendMail(email, `Don't break your ${streakDays}-day streak — Japanese with Avnish`, emailWrapper(content, ""));
}

export async function sendQuizResults(
  email: string,
  level: string,
  pricingUrl: string
) {
  const products = await getProductsForEmail();
  const productList = productListHtml(products, SITE_URL);

  const dbTemplate = await renderDbEmailTemplate("quiz-results", { level, pricingUrl });
  if (dbTemplate) return sendMail(email, dbTemplate.subject, emailWrapper(dbTemplate.bodyHtml, productList));

  const content = `
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Based on your quiz results, we recommend the <strong>${level}</strong> level.</p>
    <p style="margin:0 0 24px;"><a href="${pricingUrl}" style="background:#D0021B;color:white;padding:12px 26px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;">Explore Premium</a></p>
    <p style="font-size:14px;line-height:1.6;margin:0;color:#555;">— Japanese with Avnish</p>
  `;
  return sendMail(email, `Your JLPT level: ${level} — Japanese with Avnish`, emailWrapper(content, productList));
}

export async function sendWelcomeNewsletter(email: string, name?: string) {
  const products = await getProductsForEmail();
  const productList = productListHtml(products, SITE_URL);

  const dbTemplate = await renderDbEmailTemplate("welcome-newsletter", { name: name || "there" });
  if (dbTemplate) return sendMail(email, dbTemplate.subject, emailWrapper(dbTemplate.bodyHtml, productList));

  const content = welcomeNewsletterContent(name || "");
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
  const products = await getProductsForEmail();
  const productList = productListHtml(products, SITE_URL);

  const dbTemplate = await renderDbEmailTemplate("new-comment", { name, postTitle, postUrl, commenterName, commentPreview });
  if (dbTemplate) return sendMail(email, dbTemplate.subject, emailWrapper(dbTemplate.bodyHtml, productList));

  const content = newCommentNotificationContent(
    name,
    postTitle,
    postUrl,
    commenterName,
    commentPreview
  );
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
  const products = await getProductsForEmail();
  const productList = productListHtml(products, SITE_URL);

  const dbTemplate = await renderDbEmailTemplate("community-guidelines", { name, postTitle, postUrl });
  if (dbTemplate) return sendMail(email, dbTemplate.subject, emailWrapper(dbTemplate.bodyHtml, productList));

  const content = communityGuidelinesContent(name, postTitle, postUrl);
  return sendMail(email, "Community guidelines — Japanese with Avnish", emailWrapper(content, productList));
}

export async function sendContactFormNotification(
  to: string,
  name: string,
  fromEmail: string,
  message: string
): Promise<{ id?: string } | null> {
  const escapedName = name.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escapedEmail = fromEmail.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escapedMessage = message.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
  const html = `
    <p><strong>From:</strong> ${escapedName} &lt;${escapedEmail}&gt;</p>
    <p><strong>Message:</strong></p>
    <p>${escapedMessage}</p>
  `;
  return sendMail(to, `Contact form: ${name} — Japanese with Avnish`, html);
}

export async function sendPaymentFailedRetryEmail(
  email: string,
  name: string,
  productUrl: string,
  productName?: string
) {
  const productLabel = productName || "your order";
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

export async function sendFeedbackNotification(
  to: string,
  name: string,
  fromEmail: string,
  message: string
): Promise<{ id?: string } | null> {
  const escapedName = (name || "Anonymous").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escapedEmail = (fromEmail || "Not provided").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escapedMessage = message.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
  const html = `
    <p><strong>From:</strong> ${escapedName} &lt;${escapedEmail}&gt;</p>
    <p><strong>Suggestion / Feedback:</strong></p>
    <p>${escapedMessage}</p>
  `;
  return sendMail(to, `New feedback from ${escapedName} — Japanese with Avnish`, html);
}

/** Gap-fix phase 22: notifies a learner when the content issue they reported (via the
 * report-issue widget, learner_content_reports) has been marked resolved by an admin —
 * closing the loop so a learner who took the time to report something knows it was acted on. */
export async function sendLearnerReportResolvedEmail(
  email: string,
  contentTitle: string,
  contentUrl: string | null,
  reportMessage: string
): Promise<{ id?: string } | null> {
  const escapedMessage = escapeHtml(reportMessage).replace(/\n/g, "<br>");
  const linkHtml = contentUrl
    ? `<p style="margin:0 0 20px;"><a href="${contentUrl}" style="background:#D0021B;color:white;padding:12px 26px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;">View the updated content</a></p>`
    : "";
  const content = `
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi there,</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Thanks for reporting an issue on "<strong>${escapeHtml(contentTitle)}</strong>" — we've reviewed it and marked it resolved.</p>
    <p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:#555;">Your report: "${escapedMessage}"</p>
    ${linkHtml}
    <p style="font-size:14px;line-height:1.6;margin:0;color:#555;">Thank you for helping us keep the content accurate.</p>
    <p style="font-size:14px;line-height:1.6;margin:16px 0 0;">— Japanese with Avnish</p>
  `;
  return sendMail(email, `Your reported issue on "${contentTitle}" has been resolved — Japanese with Avnish`, emailWrapper(content, ""));
}

/** Generic admin-to-user reply, used by the Contact/Comments/Feedback admin reply flows. */
export async function sendAdminReplyEmail(
  to: string,
  subject: string,
  replyBody: string
): Promise<{ id?: string } | null> {
  const escapedBody = escapeHtml(replyBody).replace(/\n/g, "<br>");
  const html = `<p>${escapedBody}</p>`;
  return sendMail(to, subject, emailWrapper(html));
}
