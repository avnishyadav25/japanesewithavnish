-- DB-backed, admin-editable email templates. Subject/body support {{variable}} placeholders,
-- substituted at send time. Falls back to hardcoded content in src/lib/email.ts if a row is missing.
CREATE TABLE IF NOT EXISTS email_templates (
  key TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO email_templates (key, subject, body_html) VALUES
(
  'magic-link',
  'Login to Japanese with Avnish',
  '<p>Click the link below to access your library:</p>
      <p><a href="{{magicLinkUrl}}" style="color:#D0021B;font-weight:600;">Access Store</a></p>
      <p>This link expires in 1 hour.</p>
      <p>If you didn''t request this, you can ignore this email.</p>'
),
(
  'welcome-newsletter',
  'Welcome to Japanese with Avnish — JLPT tips & updates',
  '<p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi {{name}},</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Welcome to our newsletter! You''ll receive JLPT tips, study resources, and updates to help you on your Japanese learning journey.</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 24px;">— Japanese with Avnish</p>'
),
(
  'order-confirmation',
  'Your purchase is ready — Japanese with Avnish',
  '<p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi {{name}},</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Thank you for your purchase! Your access is ready.</p>
    <p style="margin:0 0 16px;"><a href="{{accessUrl}}" style="background:#D0021B;color:white;padding:12px 26px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;">Access your content</a></p>
    <p style="margin:0 0 16px;"><a href="{{orderDetailUrl}}" style="color:#D0021B;font-weight:600;">View order details</a></p>
    <p style="font-size:14px;line-height:1.6;margin:0;color:#555;">Order ID: {{orderId}}</p>
    <p style="font-size:14px;line-height:1.6;margin:8px 0 0;color:#555;">You can return to your library anytime using the link above (it stays valid for 30 days).</p>
    <p style="font-size:14px;line-height:1.6;margin:16px 0 0;">— Japanese with Avnish</p>'
),
(
  'quiz-results',
  'Your JLPT level: {{level}} — Japanese with Avnish',
  '<p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Based on your quiz results, we recommend the <strong>{{level}}</strong> level.</p>
    <p style="margin:0 0 24px;"><a href="{{pricingUrl}}" style="background:#D0021B;color:white;padding:12px 26px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;">Explore Premium</a></p>
    <p style="font-size:14px;line-height:1.6;margin:0;color:#555;">— Japanese with Avnish</p>'
),
(
  'new-comment',
  'New comment on "{{postTitle}}" — Japanese with Avnish',
  '<p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi {{name}},</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;"><strong>{{commenterName}}</strong> commented on <strong>{{postTitle}}</strong>:</p>
    <p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:#555;font-style:italic;">"{{commentPreview}}"</p>
    <p style="margin:0 0 24px;">
      <a href="{{postUrl}}" style="background:#D0021B;color:white;padding:12px 26px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;">Read the discussion</a>
    </p>
    <p style="font-size:14px;line-height:1.6;margin:0;color:#555;">— Japanese with Avnish</p>'
),
(
  'community-guidelines',
  'Community guidelines — Japanese with Avnish',
  '<p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi {{name}},</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">We noticed your comment on <strong>{{postTitle}}</strong>. Please review our community guidelines to ensure a respectful and helpful environment for all learners.</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">We encourage constructive, on-topic discussions. Be kind and supportive to fellow learners.</p>
    <p style="margin:0 0 24px;">
      <a href="{{postUrl}}" style="background:#D0021B;color:white;padding:12px 26px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;">View the post</a>
    </p>
    <p style="font-size:14px;line-height:1.6;margin:0;color:#555;">— Japanese with Avnish</p>'
)
ON CONFLICT (key) DO NOTHING;
