-- Per-level daily routine baseline (min counts to meet "today's routine").

SET search_path TO public;

CREATE TABLE IF NOT EXISTS daily_routine_baseline (
  level_code TEXT NOT NULL PRIMARY KEY,
  min_kanji INTEGER NOT NULL DEFAULT 0,
  min_reading INTEGER NOT NULL DEFAULT 0,
  min_grammar INTEGER NOT NULL DEFAULT 0,
  min_vocab INTEGER NOT NULL DEFAULT 0,
  min_review INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO daily_routine_baseline (level_code, min_kanji, min_reading, min_grammar, min_vocab, min_review)
VALUES
  ('N5', 10, 1, 3, 5, 5),
  ('N4', 15, 1, 5, 8, 8),
  ('N3', 20, 1, 5, 10, 10),
  ('N2', 20, 1, 5, 10, 10),
  ('N1', 20, 1, 5, 10, 10)
ON CONFLICT (level_code) DO NOTHING;

COMMENT ON TABLE daily_routine_baseline IS 'Minimum daily activity counts per JLPT level for routine checklist';
