SET search_path TO public;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR'
  CHECK (currency IN ('INR', 'USD'));

