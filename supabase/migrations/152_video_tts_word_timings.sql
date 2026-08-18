-- Per-word timings alongside each cached TTS clip, for word-by-word ("karaoke") captions.
--
-- WHY A COLUMN AND NOT A NEW CACHE KEY. The cache is keyed on sha256(ssml + voice + rate + pitch).
-- Getting word timings out of Google means adding <mark> tags to the SSML — which changes that
-- string, and would therefore invalidate every clip already cached and re-bill the entire back
-- catalogue. Marks are zero-duration and alter no audio sample, so the hash deliberately keeps
-- being computed on the MARK-FREE ssml and the timings ride along in this column instead.
--
-- Nullable, and expected to stay null for: rows cached before this existed, Chirp3-HD voices
-- (which reject SSML outright), and Japanese segments (no whitespace to split on). All three fall
-- back to proportional estimation from the measured per-language speech rates.
ALTER TABLE video_tts_assets
  ADD COLUMN IF NOT EXISTS word_timings JSONB;
