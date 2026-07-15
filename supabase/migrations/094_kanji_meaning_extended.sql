-- Split kanji.meaning into a short primary meaning + an optional extended
-- field for rare/historical/dictionary-dump senses, shown behind a disclosure.
ALTER TABLE kanji ADD COLUMN IF NOT EXISTS meaning_extended TEXT;
