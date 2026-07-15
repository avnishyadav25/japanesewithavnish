-- Verb transitivity (e.g. 開ける transitive vs 開く intransitive), shown alongside
-- part-of-speech on the vocabulary detail page. Additive, nullable — not required
-- for non-verb entries.
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS transitivity TEXT
  CHECK (transitivity IN ('transitive', 'intransitive', 'both'));
