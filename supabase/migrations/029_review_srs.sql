-- SRS (spaced repetition) and user learning progress for Nihongo Navi
SET search_path TO public;

-- Items scheduled for review (vocab, kanji, grammar)
CREATE TABLE IF NOT EXISTS review_schedule (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT NOT NULL,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  next_review_at TIMESTAMPTZ NOT NULL,
  interval_days INTEGER DEFAULT 1,
  ease_factor REAL DEFAULT 2.5,
  repetitions INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_email, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_review_schedule_user_next ON review_schedule(user_email, next_review_at);

-- User progress on learning content (viewed, learned)
CREATE TABLE IF NOT EXISTS user_learning_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT NOT NULL,
  content_slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'viewed',
  last_reviewed_at TIMESTAMPTZ,
  next_review_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_email, content_slug)
);

CREATE INDEX IF NOT EXISTS idx_user_learning_progress_email ON user_learning_progress(user_email);
