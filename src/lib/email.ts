import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM_EMAIL = process.env.EMAIL_FROM || "Japanese with Avnish <noreply@japanesewithavnish.com>";

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
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Your purchase is ready — Japanese with Avnish",
    html: `
      <p>Hi ${name},</p>
      <p>Thank you for your purchase! Your digital bundle is ready.</p>
      <p><a href="${libraryUrl}" style="background:#D0021B;color:white;padding:12px 26px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:600;">Access My Library</a></p>
      <p>Order ID: ${orderId}</p>
      <p>You can access your downloads anytime by logging in with this email.</p>
      <p>— Japanese with Avnish</p>
    `,
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
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: `Your JLPT level: ${level} — Japanese with Avnish`,
    html: `
      <p>Based on your quiz results, we recommend the <strong>${level}</strong> level.</p>
      <p>Your best fit: <strong>${recommendedBundle}</strong></p>
      <p><a href="${productUrl}" style="background:#D0021B;color:white;padding:12px 26px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:600;">Get Your Bundle</a></p>
      <p>— Japanese with Avnish</p>
    `,
  });
  if (error) throw error;
  return data;
}
