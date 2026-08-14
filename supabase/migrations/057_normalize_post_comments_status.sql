SET search_path TO public;

-- Normalize legacy/typo status values so comments render everywhere.
UPDATE post_comments
SET status = 'approved'
WHERE status = 'approve';

