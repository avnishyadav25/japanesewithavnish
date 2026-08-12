-- Video Studio: opt a project into a real-page B-roll beat.
--
-- Off by default. Capturing costs a browser launch per video, and a 60-second vocabulary short
-- rarely has room for it — but on a longer format, or anything used as marketing, cutting to
-- the actual live page is the whole point of the hybrid template + B-roll approach.
SET search_path TO public;

ALTER TABLE video_projects
  ADD COLUMN IF NOT EXISTS include_broll BOOLEAN NOT NULL DEFAULT false;
