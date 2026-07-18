-- Per-content-type DB-editable image prompts for the new dedicated Vocabulary/
-- Grammar/Kanji editors (Phase 1 of the admin content-editor overhaul), same
-- pattern as curriculum_feature_image (migration 048): admin-editable at
-- /admin/prompts, checked before falling back to the hardcoded "learning"
-- template in src/lib/ai/image-prompts.ts.
-- Placeholders: {{title}} = word/pattern/character; {{jlptLevel}} = N5..N1; {{contentType}} = vocabulary|grammar|kanji.
SET search_path TO public;

INSERT INTO ai_prompts (key, content, updated_at) VALUES
('learning_vocabulary_image', $p$A clean flat-vector educational card image for the Japanese vocabulary word "{{title}}", JLPT {{jlptLevel}}.
Display "{{title}}" prominently at the top center in large, bold, readable typography, dark charcoal color (#1A1A1A).
Show a minimal study desk scene below: an open notebook, a pencil, and a small speech-bubble icon suggesting pronunciation practice. Calm academic atmosphere, lots of white space.
Style: flat vector illustration, minimal Japanese aesthetic. Background soft off-white (#FAF8F5) with subtle cherry blossom petals. Negative prompt: no anime, no people faces, no clutter, no neon colors.
At the bottom of the image, display the text japanesewithavnish.com in clean, readable typography (subtle but legible).$p$, NOW()),

('learning_grammar_image', $p$A clean flat-vector educational card image for the Japanese grammar point "{{title}}", JLPT {{jlptLevel}}.
Display "{{title}}" prominently at the top center in large, bold, readable typography, dark charcoal color (#1A1A1A).
Show a minimal study desk scene below: an open grammar textbook with a sentence-structure diagram (simple boxes and arrows), a pencil. Calm academic atmosphere, lots of white space.
Style: flat vector illustration, minimal Japanese aesthetic. Background soft off-white (#FAF8F5) with subtle cherry blossom petals. Negative prompt: no anime, no people faces, no clutter, no neon colors.
At the bottom of the image, display the text japanesewithavnish.com in clean, readable typography (subtle but legible).$p$, NOW()),

('learning_kanji_image', $p$A clean flat-vector educational card image for the kanji character "{{title}}", JLPT {{jlptLevel}}.
Display the kanji "{{title}}" very large and centered, in bold brush-stroke-inspired typography, dark charcoal color (#1A1A1A), as the visual focal point.
Show a minimal study desk scene below: a stroke-order practice grid, a calligraphy brush or pencil. Calm academic atmosphere, lots of white space.
Style: flat vector illustration, minimal Japanese aesthetic. Background soft off-white (#FAF8F5) with subtle cherry blossom petals. Negative prompt: no anime, no people faces, no clutter, no neon colors.
At the bottom of the image, display the text japanesewithavnish.com in clean, readable typography (subtle but legible).$p$, NOW())
ON CONFLICT (key) DO NOTHING;
