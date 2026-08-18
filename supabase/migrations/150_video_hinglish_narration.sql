-- Hinglish as a fourth narration language.
--
-- Romanised Hindi-English read by an Indian English voice — the register this audience actually
-- speaks, and the same convention the social engine already uses (social_variants.lang allows
-- 'hinglish' since migration 143). Devanagari stays 'hi'; Latin script is 'hinglish'.
--
-- They are separate values rather than one because they need different voices and pace measurably
-- differently: 14.29 chars/sec for Devanagari on hi-IN, 15.45 for romanised on en-IN. One value
-- would mean one word budget for two different things.
--
-- NOTE video_projects.narration_langs is a bare TEXT[] with no CHECK (134:78), so it needs no
-- change — which is also why an invalid language could reach a project before hitting the
-- storyboard constraint below. Validation there is in the route, against NARRATION_LANGS.
SET search_path TO public;

ALTER TABLE video_storyboards DROP CONSTRAINT IF EXISTS video_storyboards_narration_lang_check;
ALTER TABLE video_storyboards
  ADD CONSTRAINT video_storyboards_narration_lang_check
  CHECK (narration_lang IN ('en', 'hi', 'hinglish', 'ja'));

ALTER TABLE video_renders DROP CONSTRAINT IF EXISTS video_renders_narration_lang_check;
ALTER TABLE video_renders
  ADD CONSTRAINT video_renders_narration_lang_check
  CHECK (narration_lang IN ('en', 'hi', 'hinglish', 'ja'));

COMMENT ON COLUMN video_storyboards.narration_lang IS
  'Language of the spoken explanation. Japanese terms inside a scene are always voiced by a native ja-JP voice regardless, per segment. ''hinglish'' is romanised — see publicLanguageTag() in src/lib/video/types.ts, which maps it to the BCP-47 tag hi-Latn for public output.';
