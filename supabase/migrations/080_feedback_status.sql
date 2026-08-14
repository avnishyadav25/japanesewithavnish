-- feedback table itself comes from 058_feedback.sql (never applied to prod until now).
-- Add a status column mirroring contact_submissions, since the original migration had none.
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new'
  CHECK (status IN ('new', 'read', 'replied'));
