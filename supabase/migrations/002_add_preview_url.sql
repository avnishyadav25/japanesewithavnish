-- Add optional preview/sample URL for products (public link to sample content)
ALTER TABLE products ADD COLUMN IF NOT EXISTS preview_url TEXT;
