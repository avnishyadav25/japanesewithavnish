-- Track when confirmation/access email was last sent for an order (for resend cooldown)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_confirmation_email_at TIMESTAMPTZ;
