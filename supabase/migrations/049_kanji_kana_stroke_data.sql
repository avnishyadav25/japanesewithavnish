-- Optional stroke data for writing canvas (stroke order/direction verification).
-- kanji: stroke_count already exists; add stroke_data for paths if using DB as source.
-- kana: add stroke_count and stroke_data for hiragana/katakana.

SET search_path TO public;

ALTER TABLE kanji ADD COLUMN IF NOT EXISTS stroke_data JSONB;
COMMENT ON COLUMN kanji.stroke_data IS 'Optional stroke paths for writing verification (e.g. KanjiVG-style). Keyed by stroke index.';

ALTER TABLE kana ADD COLUMN IF NOT EXISTS stroke_count INTEGER;
ALTER TABLE kana ADD COLUMN IF NOT EXISTS stroke_data JSONB;
COMMENT ON COLUMN kana.stroke_count IS 'Number of strokes for writing practice.';
COMMENT ON COLUMN kana.stroke_data IS 'Optional stroke paths for writing verification.';
