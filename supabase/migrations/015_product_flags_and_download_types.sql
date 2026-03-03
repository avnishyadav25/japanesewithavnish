-- Migration 015: Product flags and download type metadata
-- Safe to run multiple times (IF NOT EXISTS on each column).
-- Adds lightweight flags to better model digital products (PDFs, videos, bundles).

ALTER TABLE products
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS is_digital_download BOOLEAN DEFAULT TRUE;

-- Optional: where the main gated experience lives (course path, library section, etc.)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS content_path TEXT;

