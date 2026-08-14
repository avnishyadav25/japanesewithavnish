-- Curriculum (first-class tables), progress (lesson/module/level), exam_attempts, achievements, profiles extension
-- Compatible with Neon/Supabase; no dependency on auth.users. Student identified by user_email (TEXT).

SET search_path TO public;

-- ----- Curriculum -----
CREATE TABLE IF NOT EXISTS curriculum_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS curriculum_modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level_id UUID NOT NULL REFERENCES curriculum_levels(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(level_id, code)
);

CREATE INDEX IF NOT EXISTS idx_curriculum_modules_level ON curriculum_modules(level_id);

CREATE TABLE IF NOT EXISTS curriculum_submodules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module_id UUID NOT NULL REFERENCES curriculum_modules(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(module_id, code)
);

CREATE INDEX IF NOT EXISTS idx_curriculum_submodules_module ON curriculum_submodules(module_id);

CREATE TABLE IF NOT EXISTS curriculum_lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submodule_id UUID NOT NULL REFERENCES curriculum_submodules(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  goal TEXT,
  introduction TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(submodule_id, code)
);

CREATE INDEX IF NOT EXISTS idx_curriculum_lessons_submodule ON curriculum_lessons(submodule_id);

-- Links lessons to content (by slug; optional post_id for FK to posts)
CREATE TABLE IF NOT EXISTS curriculum_lesson_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID NOT NULL REFERENCES curriculum_lessons(id) ON DELETE CASCADE,
  content_slug TEXT NOT NULL,
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  content_role TEXT NOT NULL DEFAULT 'main',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_curriculum_lesson_content_lesson ON curriculum_lesson_content(lesson_id);

-- Optional: module review quiz per module
CREATE TABLE IF NOT EXISTS curriculum_module_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module_id UUID NOT NULL REFERENCES curriculum_modules(id) ON DELETE CASCADE,
  content_slug TEXT,
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_curriculum_module_reviews_module ON curriculum_module_reviews(module_id);

-- Mock exams per level
CREATE TABLE IF NOT EXISTS curriculum_level_exams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level_id UUID NOT NULL REFERENCES curriculum_levels(id) ON DELETE CASCADE,
  exam_type TEXT NOT NULL,
  title TEXT NOT NULL,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_curriculum_level_exams_level ON curriculum_level_exams(level_id);

-- ----- Profiles extension -----
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS current_level TEXT,
  ADD COLUMN IF NOT EXISTS target_level TEXT,
  ADD COLUMN IF NOT EXISTS target_date DATE;

COMMENT ON COLUMN profiles.current_level IS 'Current curriculum level (e.g. N5); set from placement or level completion';
COMMENT ON COLUMN profiles.target_level IS 'Target level (e.g. N3)';
COMMENT ON COLUMN profiles.target_date IS 'Optional target date for target_level';

-- ----- Progress (lesson, module, level) -----
CREATE TABLE IF NOT EXISTS user_lesson_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT NOT NULL,
  lesson_id UUID NOT NULL REFERENCES curriculum_lessons(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_started',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_email, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_user_lesson_progress_email ON user_lesson_progress(user_email);
CREATE INDEX IF NOT EXISTS idx_user_lesson_progress_lesson ON user_lesson_progress(lesson_id);

CREATE TABLE IF NOT EXISTS user_module_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT NOT NULL,
  module_id UUID NOT NULL REFERENCES curriculum_modules(id) ON DELETE CASCADE,
  review_passed BOOLEAN DEFAULT FALSE,
  review_passed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_email, module_id)
);

CREATE INDEX IF NOT EXISTS idx_user_module_progress_email ON user_module_progress(user_email);
CREATE INDEX IF NOT EXISTS idx_user_module_progress_module ON user_module_progress(module_id);

CREATE TABLE IF NOT EXISTS user_level_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT NOT NULL,
  level_id UUID NOT NULL REFERENCES curriculum_levels(id) ON DELETE CASCADE,
  mock_passed BOOLEAN DEFAULT FALSE,
  mock_passed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_email, level_id)
);

CREATE INDEX IF NOT EXISTS idx_user_level_progress_email ON user_level_progress(user_email);
CREATE INDEX IF NOT EXISTS idx_user_level_progress_level ON user_level_progress(level_id);

-- ----- Exam attempts -----
CREATE TABLE IF NOT EXISTS exam_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT NOT NULL,
  exam_type TEXT NOT NULL,
  level_id UUID REFERENCES curriculum_levels(id) ON DELETE SET NULL,
  module_id UUID REFERENCES curriculum_modules(id) ON DELETE SET NULL,
  score INTEGER,
  section_scores JSONB DEFAULT '{}',
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_completed ON exam_attempts(user_email, completed_at DESC);

-- ----- Achievements -----
CREATE TABLE IF NOT EXISTS achievement_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  badge_icon_url TEXT,
  points INTEGER DEFAULT 0,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT NOT NULL,
  achievement_id UUID NOT NULL REFERENCES achievement_definitions(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_email, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_email ON user_achievements(user_email);
