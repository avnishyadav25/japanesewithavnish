SET search_path TO public;

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS razorpay_plan_id_inr TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_plan_id_usd TEXT;

CREATE INDEX IF NOT EXISTS idx_subscription_plans_razorpay_plan_id_inr
  ON subscription_plans(razorpay_plan_id_inr)
  WHERE razorpay_plan_id_inr IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_plans_razorpay_plan_id_usd
  ON subscription_plans(razorpay_plan_id_usd)
  WHERE razorpay_plan_id_usd IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_provider_subscription_id
  ON user_subscriptions(provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;
