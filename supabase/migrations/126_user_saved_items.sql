-- Learner "Save" / bookmark feature (spec §13 sidebar Save button) — no prior save/bookmark
-- mechanism exists anywhere in the schema. Generalized across lessons and posts, mirroring the
-- owner_type/owner_id shape already used by user_section_progress (migration 125).
CREATE TABLE IF NOT EXISTS user_saved_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT NOT NULL,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('lesson', 'post')),
  owner_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_email, owner_type, owner_id)
);

CREATE INDEX IF NOT EXISTS idx_user_saved_items_user ON user_saved_items(user_email, created_at DESC);
