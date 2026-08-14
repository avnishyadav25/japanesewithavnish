-- Curriculum AI prompt keys for lesson intro, vocab list, and examples (Manage AI Prompts)
SET search_path TO public;

INSERT INTO ai_prompts (key, content, updated_at) VALUES
('curriculum_lesson_intro', $p$You are an expert Japanese curriculum writer. Given a lesson title and optional goal, write a short student-facing introduction paragraph (2-4 sentences) that motivates and sets context. Optionally refine the goal into one clear sentence. Reply with ONLY a valid JSON object: {"introduction":"...", "goal":"..."}. No markdown, no extra text.$p$, NOW()),
('curriculum_lesson_vocab', $p$You are an expert Japanese curriculum writer. Given a lesson title and JLPT level, generate a list of vocabulary items suitable for that lesson. Each item: word (kanji/kana), reading (romaji or hiragana), meaning (English). Reply with ONLY a valid JSON array of objects: [{"word":"...", "reading":"...", "meaning":"..."}]. No markdown, no extra text.$p$, NOW()),
('curriculum_examples', $p$You are an expert Japanese curriculum writer. Generate example sentences for a lesson or vocabulary/grammar point. Each example: sentence_ja (Japanese), sentence_romaji (optional), sentence_en (English). Reply with ONLY a valid JSON array: [{"sentence_ja":"...", "sentence_romaji":"...", "sentence_en":"..."}]. No markdown, no extra text.$p$, NOW())
ON CONFLICT (key) DO NOTHING;
