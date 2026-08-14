ALTER TABLE lesson_blocks
  ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'none'
    CHECK (review_status IN ('none', 'pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS generated_by_model TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_lesson_blocks_review_status ON lesson_blocks(review_status) WHERE review_status = 'pending';
