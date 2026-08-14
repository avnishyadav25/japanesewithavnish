-- Adds data-quality fields used by the Japanese curriculum cleanup.

SET search_path TO public;

ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS jlpt_level TEXT;
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS part_of_speech TEXT;
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS romaji TEXT;

ALTER TABLE kanji ADD COLUMN IF NOT EXISTS jlpt_level TEXT;

CREATE INDEX IF NOT EXISTS idx_vocabulary_jlpt_level ON vocabulary(jlpt_level);
CREATE INDEX IF NOT EXISTS idx_vocabulary_part_of_speech ON vocabulary(part_of_speech);
CREATE INDEX IF NOT EXISTS idx_kanji_jlpt_level ON kanji(jlpt_level);

COMMENT ON COLUMN vocabulary.jlpt_level IS 'Direct JLPT level for filtering and review; backfilled from linked post level where possible.';
COMMENT ON COLUMN vocabulary.part_of_speech IS 'Learner-facing lexical category such as noun, verb, i-adjective, na-adjective, expression.';
COMMENT ON COLUMN vocabulary.romaji IS 'Optional romanization. The reading column should prefer kana.';
COMMENT ON COLUMN kanji.jlpt_level IS 'Direct JLPT level for filtering and review; backfilled from linked post level where possible.';
