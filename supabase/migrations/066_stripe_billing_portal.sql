SET search_path TO public;

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS stripe_product_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS provider_invoice_id TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
  ON profiles(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_plans_stripe_price_id
  ON subscription_plans(stripe_price_id)
  WHERE stripe_price_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_provider_subscription_id
  ON user_subscriptions(provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_payments_provider_invoice_id
  ON subscription_payments(provider_invoice_id)
  WHERE provider_invoice_id IS NOT NULL;
