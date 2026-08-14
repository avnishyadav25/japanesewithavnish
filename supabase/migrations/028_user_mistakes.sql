-- Store user sentence corrections for Nihongo Navi (optional: review mistakes later)
SET search_path TO public;

CREATE TABLE IF NOT EXISTS user_mistakes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT NOT NULL,
  original_text TEXT NOT NULL,
  corrected_text TEXT NOT NULL,
  explanation TEXT,
  source TEXT DEFAULT 'correct_sentence',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_mistakes_email ON user_mistakes(user_email);
CREATE INDEX IF NOT EXISTS idx_user_mistakes_created ON user_mistakes(created_at DESC);
