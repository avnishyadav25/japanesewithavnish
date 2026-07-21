-- learner_content_reports.entity_id was hard-FK'd to posts(id), but entity_type already makes
-- this a polymorphic reference (vocabulary/grammar/kanji/reading/listening/writing/sounds are
-- all posts-backed, but curriculum lessons are not — they live in curriculum_lessons). Dropping
-- the FK lets the existing learner-facing ReportIssueButton be reused on curriculum lesson pages
-- (spec §2/§13 "Report" button) without a parallel table. entity_type continues to gate valid
-- values at the application layer (see REPORTABLE_ENTITY_TYPES in the report-issue API route).
ALTER TABLE learner_content_reports DROP CONSTRAINT IF EXISTS learner_content_reports_entity_id_fkey;
