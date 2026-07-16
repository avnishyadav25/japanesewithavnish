-- Gap-fix phase 17: why_it_matters, distinct from description. description explains WHAT is
-- wrong; why_it_matters explains the learner-facing consequence (why a human reviewer should
-- care enough to act on it) — the founder's spec drew this distinction explicitly.
SET search_path TO public;

ALTER TABLE content_review_findings ADD COLUMN IF NOT EXISTS why_it_matters TEXT;
