-- Prevent duplicate learning content rows after cleanup.

SET search_path TO public;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vocabulary_normalized_word_reading_unique
  ON vocabulary (lower(trim(word)), coalesce(lower(trim(reading)), ''))
  WHERE word IS NOT NULL AND trim(word) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_grammar_normalized_pattern_unique
  ON grammar (lower(trim(pattern)))
  WHERE pattern IS NOT NULL AND trim(pattern) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_kanji_character_unique
  ON kanji (character)
  WHERE character IS NOT NULL AND trim(character) <> '';
