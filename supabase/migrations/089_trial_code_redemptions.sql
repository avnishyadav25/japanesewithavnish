-- Tracks who has redeemed which trial code, preventing the same user from redeeming twice.
CREATE TABLE IF NOT EXISTS trial_code_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trial_code_id UUID NOT NULL REFERENCES trial_codes(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  redeemed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (trial_code_id, user_email)
);

CREATE INDEX IF NOT EXISTS idx_trial_code_redemptions_user_email ON trial_code_redemptions(user_email);
