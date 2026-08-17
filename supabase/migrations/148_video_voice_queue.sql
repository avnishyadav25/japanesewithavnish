-- Work list for off-box voice synthesis.
--
-- WHY A TABLE AND NOT A RECOMPUTED LIST. The renderer finds narration audio by
-- ttsHash = sha256(`${ssml} ${voiceName} ${speakingRate} ${pitch}`) — a JavaScript template
-- string. A notebook recomputing that in Python would produce a different key for the same
-- segment, because JS renders ${1.0} as "1" while Python's f"{1.0}" gives "1.0". Every clip
-- generated would then be a cache miss the renderer silently ignores, which presents as
-- "cloning did nothing" rather than as an error.
--
-- So the hash is computed once, by the same TypeScript the renderer uses, and stored here. The
-- GPU side reads this table, synthesises, and writes video_tts_assets. It never derives a key.
--
-- video_tts_assets cannot double as the queue: audio_url and duration_seconds are both NOT NULL,
-- so a pending row cannot exist in it.
SET search_path TO public;

CREATE TABLE IF NOT EXISTS video_voice_queue (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  storyboard_id UUID NOT NULL REFERENCES video_storyboards(id) ON DELETE CASCADE,
  -- The cache key the renderer will look up. Unique so re-queueing a storyboard is idempotent
  -- and two storyboards sharing an identical line queue it once.
  text_hash     TEXT NOT NULL UNIQUE,
  segment_id    TEXT NOT NULL,
  -- What Chatterbox actually speaks. Plain text, because the model takes no markup.
  text          TEXT NOT NULL,
  -- Kept so the stored hash stays auditable: given these four columns, ttsHash() must reproduce
  -- text_hash exactly. That is a checkable invariant, not a comment.
  ssml          TEXT NOT NULL,
  lang          TEXT NOT NULL,
  voice_name    TEXT NOT NULL,
  speaking_rate NUMERIC NOT NULL,
  pitch         NUMERIC NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'done', 'failed')),
  error_message TEXT,
  claimed_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The notebook's only read: pending work, oldest first. Free-tier sessions are capped at 12
-- hours and can be killed sooner, so progress has to be durable per row rather than per run.
CREATE INDEX IF NOT EXISTS idx_video_voice_queue_pending
  ON video_voice_queue (created_at) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_video_voice_queue_storyboard
  ON video_voice_queue (storyboard_id);

COMMENT ON TABLE video_voice_queue IS
  'Lines awaiting cloned-voice synthesis on an external GPU. Filled by scripts/clone-voice.ts --queue; drained by notebooks/clone-voice.ipynb, which writes video_tts_assets. See docs/VIDEO_MANUAL_STEPS.md.';
COMMENT ON COLUMN video_voice_queue.text_hash IS
  'ttsHash() output from src/lib/video/tts.ts. NEVER recompute this outside that function — JS and Python format numbers differently and the mismatch is silent.';
