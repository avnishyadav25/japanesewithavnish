const PRIMARY = "#D0021B";
const BASE = "#FAF8F5";
const CHARCOAL = "#1A1A1A";
const SECONDARY = "#555555";

export type EmailProduct = {
  slug: string;
  name: string;
  price_paise: number;
  image_url?: string | null;
  jlpt_level?: string | null;
};

/**
 * Bundle/Store checkout is disabled (Premium Pass is the only purchase flow now),
 * so the product-grid footer is suppressed rather than promoting dead-end /product/* links.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function productListHtml(_products: EmailProduct[], _siteUrl: string): string {
  return "";
}

export function emailWrapper(content: string, productList?: string) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:system-ui,-apple-system,sans-serif;background:${BASE};color:${CHARCOAL};">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <a href="https://japanesewithavnish.com" style="font-size:18px;font-weight:700;color:${PRIMARY};text-decoration:none;">japanesewithavnish.com</a>
    </div>
    <div style="background:#fff;border-radius:16px;padding:24px;border:1px solid #eee;">
      ${content}
      ${productList || ""}
    </div>
    <div style="text-align:center;margin-top:24px;font-size:12px;color:${SECONDARY};">
      © ${new Date().getFullYear()} Japanese with Avnish. All rights reserved.
    </div>
  </div>
</body>
</html>`;
}

export function welcomeNewsletterContent(name: string) {
  const displayName = name || "there";
  return `
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi ${displayName},</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Welcome to our newsletter! You'll receive JLPT tips, study resources, and updates to help you on your Japanese learning journey.</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">— Japanese with Avnish</p>
  `;
}

export function newCommentNotificationContent(
  recipientName: string,
  postTitle: string,
  postUrl: string,
  commenterName: string,
  commentPreview: string
) {
  const displayName = recipientName || "there";
  const preview = commentPreview.length > 120 ? commentPreview.slice(0, 120) + "…" : commentPreview;
  return `
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi ${displayName},</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;"><strong>${commenterName}</strong> commented on <strong>${postTitle}</strong>:</p>
    <p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:${SECONDARY};font-style:italic;">"${preview}"</p>
    <p style="margin:0 0 24px;">
      <a href="${postUrl}" style="background:${PRIMARY};color:white;padding:12px 26px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;">Read the discussion</a>
    </p>
    <p style="font-size:14px;line-height:1.6;margin:0;color:${SECONDARY};">— Japanese with Avnish</p>
  `;
}

export function communityGuidelinesContent(name: string, postTitle: string, postUrl: string) {
  const displayName = name || "there";
  return `
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi ${displayName},</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">We noticed your comment on <strong>${postTitle}</strong>. Please review our community guidelines to ensure a respectful and helpful environment for all learners.</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">We encourage constructive, on-topic discussions. Be kind and supportive to fellow learners.</p>
    <p style="margin:0 0 24px;">
      <a href="${postUrl}" style="background:${PRIMARY};color:white;padding:12px 26px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;">View the post</a>
    </p>
    <p style="font-size:14px;line-height:1.6;margin:0;color:${SECONDARY};">— Japanese with Avnish</p>
  `;
}

export function newsletterContent(htmlBody: string) {
  return htmlBody;
}
