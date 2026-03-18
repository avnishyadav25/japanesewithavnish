-- Type-specific tables for learn content: one row per post, optional structured fields.
-- Main content stays in posts.content and posts.meta; these tables allow richer queries per type.

SET search_path TO public;

-- vocabulary: word, reading, meaning; rest in posts.meta
CREATE TABLE IF NOT EXISTS vocabulary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE UNIQUE,
  word TEXT,
  reading TEXT,
  meaning TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vocabulary_post_id ON vocabulary(post_id);
CREATE INDEX IF NOT EXISTS idx_vocabulary_word ON vocabulary(word);

-- grammar: pattern, structure, level; rest in posts.meta
CREATE TABLE IF NOT EXISTS grammar (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE UNIQUE,
  pattern TEXT,
  structure TEXT,
  level TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_grammar_post_id ON grammar(post_id);

-- kanji: character, readings, stroke count, meaning; rest in posts.meta
CREATE TABLE IF NOT EXISTS kanji (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE UNIQUE,
  character TEXT,
  onyomi TEXT[],
  kunyomi TEXT[],
  stroke_count INTEGER,
  meaning TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kanji_post_id ON kanji(post_id);
CREATE INDEX IF NOT EXISTS idx_kanji_character ON kanji(character);

-- reading: optional key fields; details in posts.meta
CREATE TABLE IF NOT EXISTS reading (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE UNIQUE,
  title TEXT,
  level TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reading_post_id ON reading(post_id);

-- listening: optional key fields; details in posts.meta
CREATE TABLE IF NOT EXISTS listening (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE UNIQUE,
  title TEXT,
  level TEXT,
  audio_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_listening_post_id ON listening(post_id);

-- sounds: hiragana/katakana focus; details in posts.meta
CREATE TABLE IF NOT EXISTS sounds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE UNIQUE,
  title TEXT,
  level TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sounds_post_id ON sounds(post_id);

-- writing: optional key fields; details in posts.meta
CREATE TABLE IF NOT EXISTS writing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE UNIQUE,
  title TEXT,
  level TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_writing_post_id ON writing(post_id);
