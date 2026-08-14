-- Add optional image URL for product cards (can be Supabase Storage public URL or external)
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
