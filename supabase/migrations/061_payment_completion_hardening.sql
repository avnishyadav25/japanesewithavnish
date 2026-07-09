SET search_path TO public;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES subscription_plans(id) ON DELETE SET NULL;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS provider_order_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_signature TEXT,
  ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ;

UPDATE payments
SET provider_order_id = provider_payment_id
WHERE provider_order_id IS NULL
  AND provider_payment_id LIKE 'order_%';

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_order_id
  ON payments(provider_order_id)
  WHERE provider_order_id IS NOT NULL;
