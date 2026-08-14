-- Migration 014: Add gallery_images and image_prompt to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS gallery_images JSONB DEFAULT '[]';
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_prompt TEXT;
