-- Curriculum links to vocabulary, grammar, kanji; kana table; curriculum_lesson_kana; examples table.
-- Requires: 039 (vocabulary, grammar, kanji), 041 (curriculum_lessons).

SET search_path TO public;

-- ----- Lesson–vocabulary (many-to-many) -----
CREATE TABLE IF NOT EXISTS curriculum_lesson_vocabulary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID NOT NULL REFERENCES curriculum_lessons(id) ON DELETE CASCADE,
  vocabulary_id UUID NOT NULL REFERENCES vocabulary(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lesson_id, vocabulary_id)
);
CREATE INDEX IF NOT EXISTS idx_curriculum_lesson_vocabulary_lesson ON curriculum_lesson_vocabulary(lesson_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_lesson_vocabulary_vocabulary ON curriculum_lesson_vocabulary(vocabulary_id);

-- ----- Lesson–grammar (many-to-many) -----
CREATE TABLE IF NOT EXISTS curriculum_lesson_grammar (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID NOT NULL REFERENCES curriculum_lessons(id) ON DELETE CASCADE,
  grammar_id UUID NOT NULL REFERENCES grammar(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lesson_id, grammar_id)
);
CREATE INDEX IF NOT EXISTS idx_curriculum_lesson_grammar_lesson ON curriculum_lesson_grammar(lesson_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_lesson_grammar_grammar ON curriculum_lesson_grammar(grammar_id);

-- ----- Lesson–kanji (many-to-many) -----
CREATE TABLE IF NOT EXISTS curriculum_lesson_kanji (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID NOT NULL REFERENCES curriculum_lessons(id) ON DELETE CASCADE,
  kanji_id UUID NOT NULL REFERENCES kanji(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lesson_id, kanji_id)
);
CREATE INDEX IF NOT EXISTS idx_curriculum_lesson_kanji_lesson ON curriculum_lesson_kanji(lesson_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_lesson_kanji_kanji ON curriculum_lesson_kanji(kanji_id);

-- ----- Kana (syllabary: hiragana / katakana) -----
CREATE TABLE IF NOT EXISTS kana (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character TEXT NOT NULL,
  type TEXT NOT NULL,
  romaji TEXT NOT NULL,
  row_label TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(character, type)
);
CREATE INDEX IF NOT EXISTS idx_kana_type ON kana(type);
CREATE INDEX IF NOT EXISTS idx_kana_romaji ON kana(romaji);

COMMENT ON TABLE kana IS 'Hiragana/katakana characters for syllabary drills and lesson kana lists';

-- ----- Lesson–kana (many-to-many) -----
CREATE TABLE IF NOT EXISTS curriculum_lesson_kana (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID NOT NULL REFERENCES curriculum_lessons(id) ON DELETE CASCADE,
  kana_id UUID NOT NULL REFERENCES kana(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lesson_id, kana_id)
);
CREATE INDEX IF NOT EXISTS idx_curriculum_lesson_kana_lesson ON curriculum_lesson_kana(lesson_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_lesson_kana_kana ON curriculum_lesson_kana(kana_id);

-- ----- Examples (sentences: lesson / vocab / grammar scoped) -----
CREATE TABLE IF NOT EXISTS examples (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID REFERENCES curriculum_lessons(id) ON DELETE CASCADE,
  vocabulary_id UUID REFERENCES vocabulary(id) ON DELETE SET NULL,
  grammar_id UUID REFERENCES grammar(id) ON DELETE SET NULL,
  sentence_ja TEXT NOT NULL,
  sentence_romaji TEXT,
  sentence_en TEXT NOT NULL,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_examples_lesson ON examples(lesson_id);
CREATE INDEX IF NOT EXISTS idx_examples_vocabulary ON examples(vocabulary_id);
CREATE INDEX IF NOT EXISTS idx_examples_grammar ON examples(grammar_id);

COMMENT ON TABLE examples IS 'Example sentences for lessons, vocabulary, or grammar points';
