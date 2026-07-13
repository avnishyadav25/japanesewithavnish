-- Read/unread tracking for the admin sidebar badge, separate from moderation status (approved/removed).
ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false;
