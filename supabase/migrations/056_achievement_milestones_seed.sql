-- Milestone achievements (streak, level mastery).

SET search_path TO public;

INSERT INTO achievement_definitions (code, name, description, points) VALUES
  ('streak_7', '7-day streak', 'Studied 7 days in a row', 25),
  ('streak_30', '30-day streak', 'Studied 30 days in a row', 100),
  ('level_n5_mock', 'N5 mock passed', 'Passed the N5 mock exam', 50),
  ('level_n4_mock', 'N4 mock passed', 'Passed the N4 mock exam', 50),
  ('level_n3_mock', 'N3 mock passed', 'Passed the N3 mock exam', 50)
ON CONFLICT (code) DO NOTHING;
