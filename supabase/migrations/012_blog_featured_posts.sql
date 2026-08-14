-- Blog featured posts (curated in admin, 2 slugs for featured row)
INSERT INTO site_settings (key, value) VALUES
  ('blog_featured_posts', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;
