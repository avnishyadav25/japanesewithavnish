-- Review Policies: externalizes deterministicChecks.ts's previously-hardcoded
-- REQUIRED_FIELD_BY_TYPE map into an admin-editable table, per the spec's "Review rules by
-- content type" section. Seeded with the exact same values the hardcoded map already used,
-- so behavior doesn't change until an admin actually edits a policy.
SET search_path TO public;

CREATE TABLE IF NOT EXISTS content_review_policies (
  content_type    TEXT PRIMARY KEY,
  required_fields TEXT[] NOT NULL DEFAULT '{}',
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO content_review_policies (content_type, required_fields) VALUES
  ('vocabulary', '{word}'),
  ('grammar', '{pattern}'),
  ('kanji', '{character}'),
  ('reading', '{title}'),
  ('listening', '{title}'),
  ('writing', '{title}'),
  ('sounds', '{title}')
ON CONFLICT (content_type) DO NOTHING;
