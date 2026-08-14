-- Grammar: a speakable form of each pattern.
--
-- 280 of 548 published patterns are mixed notation — "Verb volitional form + と思います",
-- "Vて-form + ください". That is the correct way to WRITE a grammar point, and the pattern column
-- must keep it. But the Video Studio hands `pattern` to a Japanese text-to-speech voice, which
-- reads "Verb volitional form" with Japanese phonetics and produces gibberish. Half of every
-- grammar video would be unusable.
--
-- pattern_spoken holds only what should be said aloud (と思います), and pattern_romaji its
-- romanisation for learners who cannot yet read kana. Both are nullable: scripts/backfill-
-- grammar-spoken.ts fills them, and src/lib/video/storyboard.ts falls back to extracting the
-- Japanese runs at runtime so an unbackfilled row degrades to English-only narration rather
-- than to nonsense.
SET search_path TO public;

ALTER TABLE grammar
  ADD COLUMN IF NOT EXISTS pattern_spoken TEXT,
  ADD COLUMN IF NOT EXISTS pattern_romaji TEXT;

COMMENT ON COLUMN grammar.pattern_spoken IS
  'Japanese-only form of `pattern`, safe to send to a ja-JP TTS voice. NULL = not yet backfilled.';
COMMENT ON COLUMN grammar.pattern_romaji IS
  'Romanisation of pattern_spoken, for on-screen display to pre-kana learners.';

-- Partial index over the rows the backfill still has to visit, so repeated --apply runs stay cheap.
CREATE INDEX IF NOT EXISTS idx_grammar_pattern_spoken_pending
  ON grammar (id) WHERE pattern_spoken IS NULL;
