-- Video Studio round 4 — the Shorts preset, music tempo, and the reusable asset library.
--
-- Context: before this, `format` had no effect on timing anywhere in the pipeline. A vertical
-- render was frame-identical to a landscape one, differing only in pixel dimensions and a couple
-- of layout branches. These columns are what let a project be paced and animated as a Short.

-- 1. Which pacing/motion rules a project generates and renders under.
--
-- Defaults to 'lesson' so every existing row keeps behaving exactly as it did — the storyboards
-- already written were built with lesson beats, and rendering them under Shorts motion would hold
-- a scene that was authored as 16 seconds under a camera tuned for 3.
ALTER TABLE video_projects
  ADD COLUMN IF NOT EXISTS style_preset TEXT NOT NULL DEFAULT 'lesson';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'video_projects_style_preset_check') THEN
    ALTER TABLE video_projects
      ADD CONSTRAINT video_projects_style_preset_check CHECK (style_preset IN ('lesson', 'shorts'));
  END IF;
END $$;

-- 2. Music tempo, so a cut can land on a beat.
--
-- `loop_point_seconds` has existed since migration 134 and is read by nothing; tempo is genuinely
-- absent rather than merely unused. Nullable because detection fails on free-tempo material —
-- ambient and solo shakuhachi have no steady pulse — and a wrong BPM is worse than none, since it
-- would quantise every cut against a grid that is not there.
ALTER TABLE video_bgm_tracks
  ADD COLUMN IF NOT EXISTS bpm NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS beat_offset_seconds NUMERIC(6,3),
  -- 0-1 from the autocorrelation peak. Below ~0.35 the estimate is not trusted for quantisation.
  ADD COLUMN IF NOT EXISTS bpm_confidence NUMERIC(4,3);

-- 3. The reusable asset library: stickers, characters and textures generated once and reused.
--
-- Deliberately NOT in public/ — this library runs to dozens of PNGs and the repo already fights
-- an iCloud-synced working directory. B-roll and BGM are already served to the renderer from R2
-- over plain HTTPS, so this follows a path that is known to work in GitHub Actions.
CREATE TABLE IF NOT EXISTS video_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  -- Kept so a variant can be regenerated on-style later without re-deriving the wording.
  prompt TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'video_assets_category_check') THEN
    ALTER TABLE video_assets
      ADD CONSTRAINT video_assets_category_check
      CHECK (category IN ('food', 'object', 'animal', 'character', 'texture'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS video_assets_category_idx ON video_assets (category) WHERE is_enabled;
CREATE INDEX IF NOT EXISTS video_assets_tags_idx ON video_assets USING GIN (tags);
