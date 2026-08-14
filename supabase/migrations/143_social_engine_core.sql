-- The unified social content engine.
--
-- Supersedes video_publications / video_publish_targets (migration 136), which modelled
-- publishing but were never wired to a single line of application code. They are dropped at the
-- bottom of this file, guarded.
--
-- WHY NOT JUST EXTEND THOSE TABLES
-- The subject of a social post is not always a render. A Pinterest pin for a blog post and a
-- LinkedIn post about the product go through the same queue as a Reel. So the subject is a
-- BRIEF, which carries a typed pointer back to whatever it promotes. Widening a table named
-- video_* to hold the LinkedIn account used for text-only posts would commit every future reader
-- to decoding that name as a lie.
--
-- THE SHAPE mirrors the split Video Studio already uses — content versus execution:
--   social_channels   one account per platform          ~ video_publish_targets
--   social_briefs     the thing being promoted          ~ video_projects
--   social_variants   copy for one surface x language   ~ video_storyboards
--   social_posts      one delivery to one channel       ~ video_render_jobs + video_renders
--
-- A "surface" is platform + format (instagram.reel, x.thread). It is the unit of generation and
-- the key into PLATFORM_RULES in src/lib/social/platforms.ts.
--
-- WHERE PUBLISHING RUNS: the portable worker, never a Netlify route. Same reasoning as migration
-- 134 — a resumable upload of a 200MB landscape render cannot complete inside a ~10s function.

SET search_path TO public;

-- ---------------------------------------------------------------------------
-- Channels
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social_channels (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform                  TEXT NOT NULL CHECK (platform IN
                              ('youtube','instagram','x','facebook','threads','tiktok',
                               'pinterest','linkedin','reddit','blog')),
  label                     TEXT NOT NULL,
  handle                    TEXT,

  -- AES-256-GCM sealed envelope "v1.<iv>.<tag>.<ciphertext>" (src/lib/social/secrets.ts).
  -- NEVER selected by an API route or a server component. Every read path goes through the
  -- social_channels_public view below, which physically cannot contain this column; exactly one
  -- server-only function (getChannelRuntime) touches the base table. The previous design relied
  -- on a comment saying "don't select this", and a comment does not survive a hurried SELECT *.
  credentials_sealed        TEXT,

  -- Compare-and-swap guard for token refresh. Two concurrent publishes must not both refresh the
  -- same OAuth token and have one invalidate the other. The Neon HTTP driver has no session
  -- state, so pg_advisory_lock is not reliably available to the worker — a version CAS is.
  credentials_version       INT NOT NULL DEFAULT 0,

  external_account_id       TEXT,
  external_account_name     TEXT,
  scopes                    TEXT[],
  token_expires_at          TIMESTAMPTZ,
  auth_status               TEXT NOT NULL DEFAULT 'never_connected'
                              CHECK (auth_status IN ('never_connected','connected','expired','revoked','error')),
  auth_error                TEXT,

  -- Non-secret per-channel settings: default privacy, playlist id, IG user id, subreddit,
  -- Pinterest board id, default flair.
  config                    JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Off until the platform's own approval is granted AND an admin flips it. Until then every
  -- publish resolves to the manual adapter, which is the day-one path rather than a fallback.
  auto_post_enabled         BOOLEAN NOT NULL DEFAULT false,
  auto_post_blocked_reason  TEXT,

  is_enabled                BOOLEAN NOT NULL DEFAULT true,
  is_default                BOOLEAN NOT NULL DEFAULT false,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_social_channels_default
  ON social_channels (platform) WHERE is_default AND is_enabled;

CREATE OR REPLACE VIEW social_channels_public AS
  SELECT id, platform, label, handle, external_account_id, external_account_name, scopes,
         token_expires_at, auth_status, auth_error, config, auto_post_enabled,
         auto_post_blocked_reason, is_enabled, is_default, credentials_version,
         (credentials_sealed IS NOT NULL) AS has_credentials,
         created_at, updated_at
  FROM social_channels;

-- ---------------------------------------------------------------------------
-- Briefs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social_briefs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_type     TEXT NOT NULL CHECK (source_type IN
                    ('video_render','post','product','newsletter','topic','legacy_pack')),

  -- Typed FKs for the two subjects that must cascade and will be numerous; source_ref JSONB for
  -- the open set. Same split video_content_links already uses for post_id/lesson_id.
  render_id       UUID REFERENCES video_renders(id) ON DELETE CASCADE,
  post_id         UUID REFERENCES posts(id) ON DELETE CASCADE,
  source_ref      JSONB NOT NULL DEFAULT '{}'::jsonb,
  legacy_pack_id  UUID REFERENCES social_content_packs(id) ON DELETE SET NULL,

  title           TEXT NOT NULL,
  summary         TEXT,
  -- Frozen facts handed to the model, so a run stays reproducible after the source is edited.
  body_context    TEXT,
  jlpt_level      TEXT,
  content_type    TEXT,
  -- Site-relative. UTM parameters are appended per platform at generation time, never stored
  -- baked in, so one brief can serve nine differently-tagged links.
  link_path       TEXT,
  utm_campaign    TEXT,

  status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','generating','ready','archived')),
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (source_type <> 'video_render' OR render_id IS NOT NULL),
  CHECK (source_type <> 'post'         OR post_id   IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_social_briefs_render ON social_briefs (render_id) WHERE render_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_social_briefs_post   ON social_briefs (post_id)   WHERE post_id   IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_social_briefs_recent ON social_briefs (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_briefs_legacy
  ON social_briefs (legacy_pack_id) WHERE legacy_pack_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Generation runs (declared before variants, which reference it)
-- ---------------------------------------------------------------------------
-- Not reusing video_generation_runs despite its kind CHECK already allowing 'metadata': that
-- table's project_id FKs video_projects, and most briefs have no video project at all.
CREATE TABLE IF NOT EXISTS social_generation_runs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brief_id            UUID REFERENCES social_briefs(id) ON DELETE CASCADE,
  -- Groups the calls behind one "generate all surfaces" click, so the UI can show a single cost
  -- figure while each call stays individually diagnosable.
  batch_id            UUID,
  variant_ids         UUID[],
  kind                TEXT NOT NULL DEFAULT 'surface'
                        CHECK (kind IN ('surface','repair','content_plan','plan_hint')),
  surface             TEXT,
  langs               TEXT[],
  model               TEXT NOT NULL,
  prompt_key          TEXT,
  system_prompt       TEXT NOT NULL,
  user_message        TEXT NOT NULL,
  raw_response        TEXT,
  prompt_tokens       INT,
  completion_tokens   INT,
  estimated_cost_usd  NUMERIC(10,6),
  status              TEXT NOT NULL DEFAULT 'ok'
                        CHECK (status IN ('ok','repaired','parse_failed','api_error','clamped')),
  error_message       TEXT,
  duration_ms         INT,
  requested_by        TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_generation_runs_brief ON social_generation_runs (brief_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_generation_runs_batch ON social_generation_runs (batch_id);
CREATE INDEX IF NOT EXISTS idx_social_generation_runs_cost  ON social_generation_runs (created_at DESC);

-- ---------------------------------------------------------------------------
-- Variants
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social_variants (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brief_id           UUID NOT NULL REFERENCES social_briefs(id) ON DELETE CASCADE,

  -- platform is CHECK'd (stable set, drives the channel join); surface deliberately is NOT. The
  -- surface list changes faster than a migration cycle, and an unknown surface is a code bug
  -- caught by the PLATFORM_RULES lookup, not a data-integrity risk.
  platform           TEXT NOT NULL CHECK (platform IN
                       ('youtube','instagram','x','facebook','threads','tiktok',
                        'pinterest','linkedin','reddit','blog')),
  surface            TEXT NOT NULL,
  lang               TEXT NOT NULL CHECK (lang IN ('en','hinglish')),
  version            INT NOT NULL DEFAULT 1,
  source             TEXT NOT NULL DEFAULT 'ai_generated'
                       CHECK (source IN ('ai_generated','human_edited','regenerated','imported')),

  -- Field shape is defined per surface in src/lib/social/platforms.ts, not here.
  content            JSONB NOT NULL,
  hashtags           TEXT[] NOT NULL DEFAULT '{}',
  media              JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- What post-generation enforcement CHANGED. Empty means the model stayed inside its budget.
  -- Non-empty is rendered in the UI: silent trimming is how you discover at post time that the
  -- CTA was cut off.
  clamp_report       JSONB NOT NULL DEFAULT '[]'::jsonb,

  approval_status    TEXT NOT NULL DEFAULT 'draft'
                       CHECK (approval_status IN ('draft','approved','rejected')),
  approved_by        TEXT,
  approved_at        TIMESTAMPTZ,
  generation_run_id  UUID REFERENCES social_generation_runs(id) ON DELETE SET NULL,
  is_current         BOOLEAN NOT NULL DEFAULT true,
  created_by         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_social_variants_current
  ON social_variants (brief_id, surface, lang) WHERE is_current;
CREATE INDEX IF NOT EXISTS idx_social_variants_brief ON social_variants (brief_id, surface);
CREATE INDEX IF NOT EXISTS idx_social_variants_platform_recent
  ON social_variants (platform, created_at DESC);

-- ---------------------------------------------------------------------------
-- Posts — one delivery to one channel
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social_posts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  variant_id          UUID NOT NULL REFERENCES social_variants(id) ON DELETE CASCADE,
  channel_id          UUID NOT NULL REFERENCES social_channels(id) ON DELETE RESTRICT,

  status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN
                        ('draft','scheduled','queued','claimed','uploading','awaiting_manual',
                         'published','failed','cancelled','removed')),
  delivery            TEXT NOT NULL DEFAULT 'manual' CHECK (delivery IN ('manual','api')),
  scheduled_for       TIMESTAMPTZ,

  -- Claim machinery copied from video_render_jobs: stale work is reclaimed off heartbeat_at
  -- rather than claimed_at, because a large upload legitimately runs longer than any fixed
  -- timeout would allow.
  claimed_at          TIMESTAMPTZ,
  heartbeat_at        TIMESTAMPTZ,
  runner              TEXT,
  runner_id           TEXT,
  attempt_count       INT NOT NULL DEFAULT 0,
  max_attempts        INT NOT NULL DEFAULT 3,

  external_id         TEXT,
  external_url        TEXT,
  external_state      TEXT,

  -- Resumable-upload bookkeeping. A killed worker resumes a 200MB YouTube upload from its offset
  -- instead of restarting it, and the session URL doubles as the idempotency key — the only
  -- thing standing between a retry and two copies of the same video on the channel.
  upload_session_url  TEXT,
  upload_offset       BIGINT NOT NULL DEFAULT 0,

  posted_by           TEXT,
  published_at        TIMESTAMPTZ,
  -- A later re-fetch confirmed the post still exists. Reddit in particular reports success and
  -- then silently removes; a 'published' row that was never verified is only a claim.
  verified_at         TIMESTAMPTZ,
  error_message       TEXT,
  log                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The double-post guard, mirroring idx_video_render_jobs_one_active. Partial, so a cancelled or
-- failed attempt can be retried while a live one cannot be duplicated.
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_posts_one_active
  ON social_posts (variant_id, channel_id)
  WHERE status IN ('scheduled','queued','claimed','uploading','published');
CREATE INDEX IF NOT EXISTS idx_social_posts_claimable
  ON social_posts (scheduled_for NULLS FIRST, created_at)
  WHERE status IN ('queued','claimed','uploading');
CREATE INDEX IF NOT EXISTS idx_social_posts_published
  ON social_posts (published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_social_posts_variant ON social_posts (variant_id);

-- ---------------------------------------------------------------------------
-- Content plans
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social_content_plans (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label              TEXT NOT NULL,
  starts_on          DATE NOT NULL,
  day_count          INT NOT NULL DEFAULT 30,
  -- [{date, platform, surface, topic, sourcePostId, sourceRenderId, reason, briefId}]
  -- DATES AND PLATFORM SLOTS ARE COMPUTED IN CODE from PLATFORM_RULES cadence. The model only
  -- fills in topics: asking an LLM to lay out a calendar produces February 30th and LinkedIn
  -- posts on a Sunday.
  slots              JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- The real coverage counts the model was given, kept so a plan can be judged against its
  -- inputs rather than taken on faith.
  coverage_snapshot  JSONB NOT NULL DEFAULT '{}'::jsonb,
  generation_run_id  UUID REFERENCES social_generation_runs(id) ON DELETE SET NULL,
  created_by         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_content_plans_recent ON social_content_plans (starts_on DESC);

-- ---------------------------------------------------------------------------
-- Retire the never-wired publishing tables from migration 136
-- ---------------------------------------------------------------------------
-- Guarded rather than trusted: if anything ever did write to them, this raises instead of
-- silently destroying it.
DO $$
DECLARE pub_count INT := 0; tgt_count INT := 0;
BEGIN
  IF to_regclass('public.video_publications') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM video_publications' INTO pub_count;
  END IF;
  IF to_regclass('public.video_publish_targets') IS NOT NULL THEN
    EXECUTE $q$SELECT COUNT(*) FROM video_publish_targets WHERE kind <> 'site'$q$ INTO tgt_count;
  END IF;

  IF pub_count > 0 OR tgt_count > 0 THEN
    RAISE EXCEPTION
      'video_publications (% rows) / non-site video_publish_targets (% rows) are not empty — migrate them into social_posts/social_channels before dropping.',
      pub_count, tgt_count;
  END IF;

  DROP TABLE IF EXISTS video_publications;
  DROP TABLE IF EXISTS video_publish_targets;
END $$;

-- video_policies.publish_target_kind is plain TEXT with no FK, so the seeded youtube/instagram/
-- tiktok dual_gate rules survive the drop above. They become reachable for the first time once
-- the publish path stops hardcoding publishTargetKind:'site'. Add the six that had no rule.
INSERT INTO video_policies (label, scope_kind, content_type, format, publish_target_kind, mode, priority)
VALUES
  ('Anything going to X',         '*','*','*','x',        'dual_gate', 50),
  ('Anything going to Facebook',  '*','*','*','facebook', 'dual_gate', 50),
  ('Anything going to Threads',   '*','*','*','threads',  'dual_gate', 50),
  ('Anything going to LinkedIn',  '*','*','*','linkedin', 'dual_gate', 50),
  ('Anything going to Pinterest', '*','*','*','pinterest','dual_gate', 50),
  ('Anything going to Reddit',    '*','*','*','reddit',   'dual_gate', 10)
ON CONFLICT (scope_kind, content_type, format, publish_target_kind) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Seed one channel per platform, so the manual path works the moment this lands
-- ---------------------------------------------------------------------------
INSERT INTO social_channels (platform, label, handle, is_default, auto_post_enabled, auto_post_blocked_reason)
VALUES
  ('youtube',  'YouTube',   'japanesewithavnish', true, false,
   'Needs Google OAuth plus a YouTube Data API audit. Until the audit passes, API uploads are forced to private. Manual upload works today.'),
  ('instagram','Instagram', 'japanesewithavnish', true, false,
   'Needs a Meta app with Advanced Access for instagram_content_publish, and a Business/Creator account linked to a Facebook Page. Manual posting works today.'),
  ('x',        'X',         'japanesewithavnish', true, false,
   'Needs an X developer app. The web intent works today.'),
  ('facebook', 'Facebook Page', 'japanesewithavnish', true, false,
   'Needs Meta Advanced Access (pages_manage_posts). The sharer intent works today.'),
  ('threads',  'Threads',   'japanesewithavnish', true, false,
   'Needs the Threads API via a Meta app. The intent URL works today.'),
  ('tiktok',   'TikTok',    'japanesewithavnish', true, false,
   'Needs a TikTok Content Posting API audit; unaudited apps can only post privately (SELF_ONLY). Manual upload works today.'),
  ('pinterest','Pinterest', 'japanesewithavnish', true, false,
   'Needs a Pinterest app with standard access. Manual pinning works today.'),
  ('linkedin', 'LinkedIn',  'japanesewithavnish', true, false,
   'Needs w_member_social, or the Community Management API for a company page. The share intent works today.'),
  ('reddit',   'Reddit',    'japanesewithavnish', true, false,
   'Auto-posting is DISABLED ON PURPOSE, not blocked by Reddit. Scheduled promotional posting is the fastest route to a shadow ban — see docs/30-day-social-media-promotion-plan.md section 2. Post by hand, as a person.'),
  ('blog',     'Site — blog draft', NULL, true, true, NULL)
ON CONFLICT DO NOTHING;
