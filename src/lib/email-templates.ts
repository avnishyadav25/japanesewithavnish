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

export function productListHtml(products: EmailProduct[], siteUrl: string): string {
  if (products.length === 0) return "";
  const base = siteUrl.replace(/\/$/, "");
  const items = products.map((p) => {
    const price = `₹${p.price_paise / 100}`;
    const url = `${base}/product/${p.slug}`;
    const img = p.image_url
      ? `<img src="${p.image_url}" alt="" width="120" height="68" style="width:120px;height:68px;object-fit:cover;border-radius:8px;display:block;" />`
      : `<div style="width:120px;height:68px;background:${BASE};border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;color:${SECONDARY};">No image</div>`;
    return `
      <td style="vertical-align:top;padding:8px;width:50%;">
        <a href="${url}" style="text-decoration:none;color:inherit;display:block;">
          ${img}
          <p style="font-size:13px;font-weight:600;margin:6px 0 2px;color:${CHARCOAL};line-height:1.3;">${p.name}</p>
          <p style="font-size:14px;font-weight:700;color:${PRIMARY};margin:0;">${price}</p>
        </a>
      </td>`;
  });
  const rows: string[] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(`<tr>${items[i]}${items[i + 1] || "<td></td>"}</tr>`);
  }
  return `
    <div style="margin-top:32px;padding-top:24px;border-top:1px solid #eee;">
      <p style="font-size:14px;font-weight:600;color:${CHARCOAL};margin:0 0 16px;">Our JLPT bundles</p>
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
        ${rows.join("")}
      </table>
      <p style="margin-top:16px;">
        <a href="${base}/store" style="background:${PRIMARY};color:white;padding:10px 20px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;font-size:14px;">Browse all bundles</a>
      </p>
    </div>`;
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
