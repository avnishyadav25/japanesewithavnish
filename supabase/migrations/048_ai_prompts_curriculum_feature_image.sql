-- Prompt for curriculum feature image generation (heading + japanesewithavnish.com at bottom)
-- Placeholders: {{title}} = level name / module title / submodule title / lesson title; {{entityType}} = level | module | submodule | lesson
SET search_path TO public;

INSERT INTO ai_prompts (key, content, updated_at) VALUES
('curriculum_feature_image', $p$A clean flat-vector educational curriculum feature image for {{entityType}}: "{{title}}".
Display the heading "{{title}}" prominently at the top center in a clean h2/h3 heading style: bold, readable typography, dark charcoal color (#1A1A1A).
Show a minimal study desk with an open notebook, hiragana chart (あ い う え お), katakana chart (カ キ ク ケ コ), simple kanji cards (日, 学, 語), pencil, and headphones neatly arranged below. Calm academic atmosphere, lots of white space.
Style: flat vector illustration, minimal Japanese aesthetic. Background soft off-white (#FAF8F5) with subtle cherry blossom petals. Negative prompt: no anime, no people faces, no clutter, no neon colors.
At the bottom of the image, display the text japanesewithavnish.com in clean, readable typography (subtle but legible).$p$, NOW())
ON CONFLICT (key) DO NOTHING;
