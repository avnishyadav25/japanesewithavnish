-- Video Studio: generated-asset caches (narration audio, captured page B-roll).
--
-- Both tables exist for the same reason: the expensive part of a re-render is regenerating
-- assets that did not change. Editing a scene's colours must not re-bill Google TTS for
-- narration whose text is byte-identical, and re-rendering the same lesson at a second aspect
-- ratio must not re-drive a browser over the live site. Both are keyed by a hash of the
-- inputs, so cache identity survives scene reordering and storyboard re-versioning.
SET search_path TO public;

CREATE TABLE IF NOT EXISTS video_tts_assets (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- sha256 over the exact synthesis inputs: ssml + voice + rate + pitch. Anything that would
  -- change a single audio sample must be inside this hash.
  text_hash           TEXT NOT NULL UNIQUE,
  lang_code           TEXT NOT NULL,
  voice_name          TEXT NOT NULL,
  speaking_rate       NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  pitch               NUMERIC(4,2) NOT NULL DEFAULT 0,
  -- First ~200 chars, for the admin cache browser. Not part of the hash.
  text_preview        TEXT,
  audio_url           TEXT NOT NULL,
  -- Authoritative scene timing comes from here. Computed exactly from the LINEAR16 WAV header
  -- (dataBytes / (sampleRate * channels * 2)) rather than estimated from character count —
  -- every caption cue and scene frame-span is derived from this number.
  duration_seconds    NUMERIC(8,3) NOT NULL,
  char_count          INT,
  estimated_cost_usd  NUMERIC(10,6),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_tts_assets_last_used ON video_tts_assets (last_used_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_tts_assets_voice ON video_tts_assets (lang_code, voice_name);

CREATE TABLE IF NOT EXISTS video_broll_assets (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_url        TEXT NOT NULL,
  capture_kind      TEXT NOT NULL CHECK (capture_kind IN ('still', 'scroll_clip', 'interaction_clip')),
  viewport_w        INT NOT NULL,
  viewport_h        INT NOT NULL,
  device_scale      NUMERIC(3,1) NOT NULL DEFAULT 1,
  selector          TEXT,
  -- Full Playwright recipe: waits, scroll choreography, elements to hide, cookies to inject.
  capture_recipe    JSONB NOT NULL DEFAULT '{}'::jsonb,
  recipe_hash       TEXT NOT NULL UNIQUE,
  asset_url         TEXT NOT NULL,
  duration_seconds  NUMERIC(8,3),
  -- { "postId": uuid } | { "lessonId": uuid } — lets the UI show what a capture belongs to.
  content_ref       JSONB,
  captured_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- The live site keeps changing; stale B-roll is worse than paying to re-capture. The worker
  -- treats an expired row as a miss.
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days')
);

CREATE INDEX IF NOT EXISTS idx_video_broll_assets_expiry ON video_broll_assets (expires_at);
CREATE INDEX IF NOT EXISTS idx_video_broll_assets_source ON video_broll_assets (source_url);
