SET search_path TO public;

-- 1. Extend profiles with unified schema fields
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS user_auth_id UUID,
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'premium_student', 'admin', 'editor', 'support')),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'suspended', 'deleted')),
  ADD COLUMN IF NOT EXISTS target_level TEXT CHECK (target_level IN ('N5', 'N4', 'N3', 'N2', 'N1')),
  ADD COLUMN IF NOT EXISTS current_level TEXT CHECK (current_level IN ('N5', 'N4', 'N3', 'N2', 'N1')),
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  ADD COLUMN IF NOT EXISTS language_preference TEXT NOT NULL DEFAULT 'en' CHECK (language_preference IN ('en', 'hi', 'ja')),
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS placement_quiz_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS quiz_recommended_level TEXT CHECK (quiz_recommended_level IN ('N5', 'N4', 'N3', 'N2', 'N1')),
  ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_lifetime BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS current_plan TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT;

-- 2. Subscription plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  billing_type TEXT NOT NULL CHECK (billing_type IN ('monthly', 'yearly', 'lifetime')),
  price_inr INTEGER NOT NULL, -- in paise
  price_usd INTEGER NOT NULL, -- in cents
  currency_mode TEXT NOT NULL DEFAULT 'both' CHECK (currency_mode IN ('india', 'global', 'both')),
  trial_days INTEGER NOT NULL DEFAULT 7,
  is_active BOOLEAN DEFAULT TRUE,
  is_popular BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  features TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. User subscription status & history
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status TEXT NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'expired', 'cancelled', 'manual_access', 'lifetime')),
  provider TEXT NOT NULL CHECK (provider IN ('razorpay', 'stripe', 'manual')),
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ DEFAULT NOW(),
  current_period_end TIMESTAMPTZ,
  grace_ends_at TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  cancelled_at TIMESTAMPTZ,
  manual_reason TEXT,
  granted_by_admin_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Subscription payments log
CREATE TABLE IF NOT EXISTS subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  provider TEXT NOT NULL CHECK (provider IN ('razorpay', 'stripe', 'manual')),
  provider_payment_id TEXT UNIQUE NOT NULL,
  provider_order_id TEXT,
  provider_invoice_id TEXT,
  amount INTEGER NOT NULL, -- in paise/cents
  currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency IN ('INR', 'USD')),
  status TEXT NOT NULL CHECK (status IN ('created', 'pending', 'paid', 'failed', 'refunded')),
  coupon_code TEXT,
  discount_amount INTEGER DEFAULT 0,
  paid_at TIMESTAMPTZ,
  failed_reason TEXT,
  raw_webhook_event_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Daily lesson access tracking for free users
CREATE TABLE IF NOT EXISTS daily_lesson_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  date_key TEXT NOT NULL, -- 'YYYY-MM-DD'
  lessons_allowed INTEGER NOT NULL DEFAULT 2,
  lessons_consumed INTEGER DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_email, date_key)
);

-- 6. Individual lesson access logging
CREATE TABLE IF NOT EXISTS lesson_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  lesson_id UUID NOT NULL,
  access_type TEXT NOT NULL CHECK (access_type IN ('free_daily', 'premium', 'trial', 'manual')),
  access_granted BOOLEAN NOT NULL,
  blocked_reason TEXT,
  accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Gamification: XP and Points transactions
CREATE TABLE IF NOT EXISTS xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  event_type TEXT NOT NULL,
  xp_amount INTEGER NOT NULL,
  related_entity_type TEXT,
  related_entity_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS points_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earned', 'redeemed', 'adjusted')),
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  related_entity_type TEXT,
  related_entity_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Gamification: Badges system
CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  emoji TEXT,
  color TEXT DEFAULT '#D0021B',
  icon_type TEXT NOT NULL DEFAULT 'emoji' CHECK (icon_type IN ('emoji', 'image', 'svg')),
  icon_url TEXT,
  category TEXT NOT NULL CHECK (category IN ('level', 'streak', 'skill', 'milestone', 'special')),
  trigger_type TEXT NOT NULL DEFAULT 'automatic' CHECK (trigger_type IN ('automatic', 'manual_special')),
  condition JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  awarded_by_admin_email TEXT,
  reason TEXT,
  UNIQUE (user_email, badge_id)
);
