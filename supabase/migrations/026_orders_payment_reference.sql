-- Store UTR / transaction reference and note for manual UPI orders (admin reference)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_note TEXT;
