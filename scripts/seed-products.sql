-- Seed 6 bundles for JapanesewithAvnish
-- Run in Supabase SQL Editor after migrations

INSERT INTO products (slug, name, description, price_paise, compare_price_paise, jlpt_level, badge, who_its_for, whats_included, outcome, no_refunds_note, sort_order, is_mega) VALUES
('n5-mastery-bundle', 'N5 Mastery Bundle', 'Complete N5 resources for beginners', 19900, NULL, 'N5', NULL, 'Complete beginners starting Japanese', '["Grammar guide", "Vocabulary list", "Kanji flashcards", "Practice exercises"]', 'Pass JLPT N5 with confidence', 'All digital purchases are final. No refunds.', 1, false),
('n4-upgrade-bundle', 'N4 Upgrade Bundle', 'Elementary level materials', 29900, NULL, 'N4', NULL, 'N5 passers ready for N4', '["Grammar guide", "Vocabulary", "Reading practice", "Audio files"]', 'Reach elementary proficiency', 'All digital purchases are final. No refunds.', 2, false),
('n3-power-bundle', 'N3 Power Bundle', 'Intermediate JLPT N3', 39900, NULL, 'N3', NULL, 'N4 passers aiming for N3', '["Full grammar", "Vocabulary", "Listening practice", "Mock tests"]', 'Bridge to upper intermediate', 'All digital purchases are final. No refunds.', 3, false),
('n2-pro-bundle', 'N2 Pro Bundle', 'Upper intermediate N2', 49900, NULL, 'N2', 'offer', 'N3 passers targeting N2', '["Advanced grammar", "Business vocab", "Reading comprehension", "Practice papers"]', 'Professional-level Japanese', 'All digital purchases are final. No refunds.', 4, false),
('n1-elite-bundle', 'N1 Elite Bundle', 'Advanced JLPT N1', 59900, NULL, 'N1', 'premium', 'N2 passers going for N1', '["Master grammar", "Academic vocab", "Full mock tests", "Answer keys"]', 'Achieve N1 mastery', 'All digital purchases are final. No refunds.', 5, false),
('mega-bundle', 'Complete N5–N1 Mega Bundle', 'Everything from N5 to N1 + roadmap + 10 years papers', 89900, 199600, NULL, 'premium', 'Serious learners who want it all', '["All level bundles", "Study roadmap", "10 years past papers", "Lifetime access"]', 'Complete JLPT journey in one bundle', 'All digital purchases are final. No refunds.', 6, true)
ON CONFLICT (slug) DO NOTHING;

-- Sample coupon: 10% off (discount_type: percent, discount_value: 10)
INSERT INTO coupons (code, discount_type, discount_value, max_uses) VALUES
('WELCOME10', 'percent', 10, 100)
ON CONFLICT (code) DO NOTHING;
