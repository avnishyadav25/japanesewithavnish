-- Seed sample quiz questions if none exist (for admin/quiz list)
SET search_path TO public;

INSERT INTO quiz_questions (question_text, options, correct_index, jlpt_level, sort_order)
SELECT q, o, c, l, s FROM (VALUES
  ('What does こんにちは mean?', '["Good morning", "Hello", "Goodbye", "Thank you"]'::jsonb, 1, 'N5', 1),
  ('Which is the correct reading of 水?', '["hi", "mizu", "ki", "tsuki"]'::jsonb, 1, 'N5', 2),
  ('What particle indicates the subject?', '["を", "に", "は", "で"]'::jsonb, 2, 'N5', 3),
  ('How do you say ''I eat'' in polite form?', '["食べる", "食べます", "食べた", "食べて"]'::jsonb, 1, 'N5', 4),
  ('What is 本 (hon) commonly used for?', '["Book", "Tree", "Car", "House"]'::jsonb, 0, 'N5', 5),
  ('Which is the past tense of 行く?', '["行きます", "行った", "行って", "行く"]'::jsonb, 1, 'N5', 6),
  ('What does ありがとう mean?', '["Sorry", "Please", "Thank you", "Hello"]'::jsonb, 2, 'N5', 7),
  ('How do you say ''big'' in Japanese?', '["小さい", "大きい", "新しい", "古い"]'::jsonb, 1, 'N5', 8),
  ('What is 今日?', '["Yesterday", "Today", "Tomorrow", "Week"]'::jsonb, 1, 'N5', 9),
  ('Which level is the easiest JLPT level?', '["N1", "N2", "N3", "N5"]'::jsonb, 3, 'N5', 10)
) AS t(q, o, c, l, s)
WHERE (SELECT COUNT(*) FROM quiz_questions) = 0;
