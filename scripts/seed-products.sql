-- Seed products from docs/products_export.csv (Shopify export)
-- Run in Supabase SQL Editor after migrations 001, 002, 003
-- Images: Add via Supabase Storage + product_assets, or set image_url for card thumbnails

-- Clear existing (optional - comment out to preserve orders)
-- DELETE FROM products;

INSERT INTO products (
  slug, name, description, price_paise, compare_price_paise, jlpt_level, badge,
  who_its_for, whats_included, outcome, no_refunds_note, sort_order, is_mega, preview_url, image_url
) VALUES
(
  'complete-japanese-n5-n1-mega-bundle',
  '🎌 Japanese Complete N5–N1 Mega Bundle – All Levels in One Ultimate Pack',
  'Get all JLPT levels (N5–N1) in one lifetime bundle — grammar, vocabulary, kanji, reading, listening, mock tests, and flashcards. 400+ hours of study material, lifetime access.',
  89900, 359900, NULL, 'premium',
  'Anyone serious about mastering Japanese end-to-end. Learners preparing for multiple JLPT levels (N5–N1). Professionals or students pursuing study/work opportunities in Japan.',
  '["N5 Mastery Bundle: 100 kanji, 800 words, 80 grammar points", "N4 Upgrade Bundle: 180 kanji, 1,200 words, 150 grammar points", "N3 Power Bundle: 350 kanji, 2,000 words, 250 grammar points", "N2 Pro Bundle: 600 kanji, 3,000 words, 300 grammar patterns", "N1 Elite Bundle: 1,000+ kanji, 4,000+ words, 400 grammar structures", "500+ resources, 70+ audio files, 25 mock tests", "JLPT Flashcards (N5–N1)", "Comprehensive Study Planner", "Kanji Revision Sheets (2,000+ characters)", "Lifetime access to private learner community"]',
  'Own the complete Japanese journey — from beginner to native fluency, all in one Mega Bundle.',
  'All digital purchases are final. No refunds.', 6, true,
  'https://www.youtube.com/watch?v=Uo1ETCvxod4', 'https://cdn.shopify.com/s/files/1/0970/4855/9930/files/N1_Product_Banner.png?v=1760980588'
),
(
  'japanese-n1-elite-bundle',
  '🏆 Japanese N1 Elite Bundle – Master the Language Like a Native',
  'Master Japanese like a native with the JLPT N1 Elite Bundle — advanced grammar, vocabulary, reading, listening, and idiom practice. Designed for professionals and N1 aspirants. Lifetime access.',
  59900, 249900, 'N1', 'premium',
  'JLPT N2 graduates aiming for N1 certification. Researchers, translators, and professionals using Japanese at work. Learners seeking near-native fluency and cultural depth.',
  '["N1 Kanji Encyclopedia: 1,000+ kanji", "Vocabulary Workbook: 4,000+ advanced terms", "Grammar Reference: 400 complex grammar patterns", "Reading Practice (Dokkai): essays and editorials", "Listening Practice (Chokai): business, debate, news", "JLPT N1 Mock Tests (×5)", "Printable Flashcards + Revision Planner", "Advanced keigo masterclass notes", "Business & academic writing templates"]',
  'Master Japanese like a native — begin your N1 Elite journey today and unlock true fluency.',
  'All digital purchases are final. No refunds.', 5, false,
  'https://www.youtube.com/watch?v=Uo1ETCvxod4', 'https://cdn.shopify.com/s/files/1/0970/4855/9930/files/Complete_N5-N1_Banner.png?v=1760980588'
),
(
  'japanese-n2-pro-bundle',
  '💼 Japanese N2 Pro Bundle – Achieve Advanced Japanese Skills',
  'Achieve advanced fluency with the JLPT N2 Pro Bundle — includes 600 kanji, 3,000 words, 300 grammar structures, business Japanese, reading, and listening practice. Lifetime access.',
  49900, 229900, 'N2', 'offer',
  'Learners who''ve completed N3 or intermediate level. Professionals preparing for JLPT N2 or working in Japan. Students aiming for N2 as part of college/university entry.',
  '["N2 Kanji Compendium: 600+ kanji", "Vocabulary Workbook: 3,000+ words", "Grammar Guide: 300 N2 grammar structures", "Reading Practice (Dokkai): long-form articles", "Listening Practice (Chokai): interviews, workplace dialogues", "JLPT N2 Mock Tests (×5)", "Printable Flashcards + Study Planner", "Business Japanese Phrases & Keigo Handbook"]',
  'Advance your Japanese to professional level — master N2 today and speak fluently in any setting!',
  'All digital purchases are final. No refunds.', 4, false,
  'https://www.youtube.com/watch?v=Uo1ETCvxod4', 'https://cdn.shopify.com/s/files/1/0970/4855/9930/files/N2_Product_Banner.png?v=1760980588'
),
(
  'japanese-n3-power-bundle',
  '⚡ Japanese N3 Power Bundle – Boost Your Intermediate Skills',
  'Strengthen your Japanese fluency with the JLPT N3 Power Bundle — grammar, kanji, vocabulary, reading, listening, and mock tests. Designed for intermediate learners. Lifetime access.',
  39900, 169900, 'N3', 'offer',
  'Students who''ve completed N4 or equivalent level. Learners preparing for JLPT N3. Professionals working with Japanese clients. Self-learners aiming for strong intermediate fluency.',
  '["N3 Kanji Mastery Guide: 350 essential kanji", "Vocabulary Workbook: 2,000+ words", "Grammar Workbook: 250 grammar structures", "Reading Practice (Dokkai): essays, news, stories", "Listening Practice (Chokai): natural-speed conversations", "JLPT N3 Mock Tests (×5)", "Printable Flashcards + Study Tracker", "12-week structured study roadmap"]',
  'Power up your Japanese skills today — learn, practice, and pass JLPT N3 with confidence!',
  'All digital purchases are final. No refunds.', 3, false,
  'https://www.youtube.com/watch?v=Uo1ETCvxod4', 'https://cdn.shopify.com/s/files/1/0970/4855/9930/files/N3_Product_Banner.png?v=1760980588'
),
(
  'japanese-n4-upgrade-bundle',
  '🎌 Japanese N4 Upgrade Bundle – Level Up Your Japanese Skills',
  'Advance from beginner to intermediate Japanese with the JLPT N4 Upgrade Bundle — includes grammar, kanji, vocabulary, reading, listening, and mock tests. Lifetime access.',
  29900, 129900, 'N4', 'offer',
  'Students who''ve completed JLPT N5. Learners ready to move into intermediate Japanese. Self-learners seeking a structured, next-level curriculum. Anyone preparing for JLPT N4.',
  '["N4 Kanji Workbook: 180 essential kanji", "Vocabulary Workbook: 1,200+ words", "Grammar Workbook: 150 N4 grammar points", "Reading Practice (Dokkai): short stories, news", "Listening Practice (Chokai): native audio", "JLPT N4 Mock Tests (×5)", "Flashcards + Study Timetable", "8-week study plan template"]',
  'Level up your Japanese today and prepare confidently for JLPT N4!',
  'All digital purchases are final. No refunds.', 2, false,
  'https://www.youtube.com/watch?v=Uo1ETCvxod4', 'https://cdn.shopify.com/s/files/1/0970/4855/9930/files/N4_Product_Banner.png?v=1760980588'
),
(
  'japanese-n5-mastery-bundle',
  '🔥 Japanese N5 Mastery Bundle — The Ultimate Beginner''s Japanese Starter Kit',
  'Master Japanese from scratch with the JLPT N5 Mastery Bundle — includes grammar, kanji, vocabulary, reading, listening, mock tests, and printable flashcards. Instant lifetime access.',
  19900, 99900, 'N5', 'offer',
  'Complete beginners starting from zero. Students preparing for JLPT N5. Self-learners seeking structured offline resources. Anime/culture fans wanting practical Japanese.',
  '["Kanji Mastery Guide: 100 essential kanji", "Vocabulary Workbook: 800+ beginner words", "Grammar Workbook: 80 core grammar rules", "Reading Practice (Dokkai): short passages", "Listening Audio: native speaker recordings", "JLPT N5 Mock Tests (×5)", "Printable flashcards & study trackers", "10 years of solved JLPT papers + audio"]',
  'Begin your Japanese journey today with the N5 Mastery Bundle — your first step toward JLPT success.',
  'All digital purchases are final. No refunds.', 1, false,
  'https://www.youtube.com/watch?v=Uo1ETCvxod4', 'https://cdn.shopify.com/s/files/1/0970/4855/9930/files/N5_Product_Banner.png?v=1760980588'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_paise = EXCLUDED.price_paise,
  compare_price_paise = EXCLUDED.compare_price_paise,
  jlpt_level = EXCLUDED.jlpt_level,
  badge = EXCLUDED.badge,
  who_its_for = EXCLUDED.who_its_for,
  whats_included = EXCLUDED.whats_included,
  outcome = EXCLUDED.outcome,
  no_refunds_note = EXCLUDED.no_refunds_note,
  sort_order = EXCLUDED.sort_order,
  is_mega = EXCLUDED.is_mega,
  preview_url = EXCLUDED.preview_url,
  image_url = EXCLUDED.image_url,
  updated_at = NOW();

-- Sample coupon
INSERT INTO coupons (code, discount_type, discount_value, max_uses) VALUES
('WELCOME10', 'percent', 10, 100)
ON CONFLICT (code) DO NOTHING;
