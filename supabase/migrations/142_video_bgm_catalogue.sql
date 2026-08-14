-- Video Studio: music catalogue provenance.
--
-- Tracks now arrive from four routes — a curated seed list, a pasted URL, the Pixabay API and the
-- Jamendo API — and the difference matters. A copyright claim applies retroactively to every video
-- that used a track, so where it came from and what its licence permits has to survive the import.
--
-- commercial_use is deliberately three-state rather than boolean: Jamendo returns per-track CC
-- terms and not all of them allow monetised YouTube, while a pasted URL is simply unknown until a
-- human says otherwise. "Unknown" must not read as "allowed".
SET search_path TO public;

ALTER TABLE video_bgm_tracks
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'upload'
    CHECK (source IN ('upload', 'curated', 'url_import', 'pixabay', 'jamendo')),
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS preview_url TEXT,
  ADD COLUMN IF NOT EXISTS is_instrumental BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS commercial_use TEXT NOT NULL DEFAULT 'unknown'
    CHECK (commercial_use IN ('allowed', 'not_allowed', 'unknown')),
  ADD COLUMN IF NOT EXISTS requires_attribution BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN video_bgm_tracks.commercial_use IS
  'Whether the licence permits monetised use. "unknown" is the safe default and is surfaced as a warning in the UI — it must never be treated as permission.';

-- Same external track imported twice from the same provider is the same row.
CREATE UNIQUE INDEX IF NOT EXISTS idx_video_bgm_external
  ON video_bgm_tracks (source, external_id) WHERE external_id IS NOT NULL;
