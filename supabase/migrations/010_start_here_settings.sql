-- Start Here page settings: announcement, curated posts, FAQ
INSERT INTO site_settings (key, value) VALUES
  ('start_here_announcement', '{"enabled":true,"message":"🔥 Limited Time: Mega Bundle ₹899 (Save 60%) →","href":"/product/complete-japanese-n5-n1-mega-bundle"}'::jsonb),
  ('start_here_curated_posts', '[]'::jsonb),
  ('start_here_faq', '[{"q":"What do I get after payment?","a":"Instant access via email. You get a magic link to log in and download all PDFs, audio, and materials from your Library."},{"q":"How do I access downloads later?","a":"Log in with the same email you used to purchase. Your Library shows all your bundles. Download anytime, offline."},{"q":"Do I need an account?","a":"No account needed to purchase. After payment, use the magic link sent to your email to access your Library. Use the same email anytime to log in."},{"q":"Can I study on mobile?","a":"Yes. PDFs work on any device. Download once and study offline."},{"q":"Refund policy","a":"No refunds for digital products. Preview samples before purchase."}]'::jsonb)
ON CONFLICT (key) DO NOTHING;
