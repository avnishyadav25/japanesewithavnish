-- Video Studio: pacing and voice configuration per project.
--
-- Why this exists: `target_duration_seconds` never worked. It was advisory prose in the LLM
-- prompt ("Target total length: about 60 seconds") while the per-slot word limits were hardcoded
-- constants in the skeleton builder, so nothing connected the two. Both real projects asked for
-- 60 seconds; one produced 121s and the other would have produced 6-7 minutes.
--
-- `pacing` replaces that single advisory number with values the generator actually computes
-- from. Character budgets are derived using speech rates measured from our own synthesised
-- clips (14.38 chars/sec English, 3.82 chars/sec Japanese at 0.9x) — see src/lib/video/pacing.ts.
--
-- pauseAfterJapaneseSeconds is the one that matters pedagogically: silence after each Japanese
-- phrase so the learner can say it back. It lengthens a video by adding shadowing practice
-- rather than dead air, which is the difference between a 4-minute video and a padded one.
SET search_path TO public;

ALTER TABLE video_projects
  ADD COLUMN IF NOT EXISTS pacing JSONB,
  ADD COLUMN IF NOT EXISTS voices JSONB;

COMMENT ON COLUMN video_projects.pacing IS
  'PacingConfig (src/lib/video/types.ts): secondsPerItem, repeatJapanese, pauseAfterJapaneseSeconds, scenePaddingSeconds, japaneseRate, narrationRate. NULL = per-content-type defaults.';
COMMENT ON COLUMN video_projects.voices IS
  'Per-language Google TTS voice names, e.g. {"en":"en-US-Chirp3-HD-Aoede","ja":"ja-JP-Neural2-B"}. NULL = theme defaults.';

-- Themes carry the default voices a new project starts from. Slower Japanese is the new default:
-- 0.85x is slow enough to catch each mora without sounding artificial, while narration stays at
-- 1.0x so the explanation does not drag.
UPDATE video_themes
SET default_voices = default_voices
  || '{"jaRate": 0.85, "narrationRate": 1.0}'::jsonb
WHERE NOT (default_voices ? 'jaRate');
