-- Seed a complete 100-badge catalog for learning, streaks, skills, milestones, and admin awards.
SET search_path TO public;

WITH level_badges AS (
  SELECT
    format('%s %s', level_code, title) AS name,
    lower(format('%s-%s', level_code, slug_suffix)) AS slug,
    format('%s %s: complete %s curriculum lessons.', level_code, title, lesson_count) AS description,
    emoji,
    color,
    'emoji' AS icon_type,
    NULL::text AS icon_url,
    'level' AS category,
    'automatic' AS trigger_type,
    jsonb_build_object('type', 'lesson_count', 'level', level_code, 'count', lesson_count) AS condition,
    true AS is_active
  FROM unnest(ARRAY['N5','N4','N3','N2','N1']) AS level_code
  CROSS JOIN unnest(
    ARRAY['Starter','Explorer','Builder','Finisher','Master'],
    ARRAY['starter','explorer','builder','finisher','master'],
    ARRAY[1,5,15,30,50],
    ARRAY['🌱','🧭','🧱','🎓','👑'],
    ARRAY['#4CAF50','#2196F3','#7C3AED','#D0021B','#C8A35F']
  ) AS m(title, slug_suffix, lesson_count, emoji, color)
),
streak_badges AS (
  SELECT
    format('%s-Day Streak', days) AS name,
    format('%s-day-streak', days) AS slug,
    format('Maintain a %s-day Japanese learning streak.', days) AS description,
    emoji,
    color,
    'emoji' AS icon_type,
    NULL::text AS icon_url,
    'streak' AS category,
    'automatic' AS trigger_type,
    jsonb_build_object('type', 'streak', 'days', days) AS condition,
    true AS is_active
  FROM unnest(
    ARRAY[2,3,5,7,10,14,21,30,45,60,75,90,100,120,150,180,210,240,270,365],
    ARRAY['✨','🔥','⚡','🌟','💪','🗓️','🏅','🚀','🎯','💎','🏆','🥇','🗻','🌸','🎌','👑','⭐','💫','🌅','🏯'],
    ARRAY['#4CAF50','#FF9800','#FF5722','#D0021B','#7C3AED','#2196F3','#C8A35F','#0891B2','#059669','#8B5CF6','#D97706','#DC2626','#0EA5E9','#EC4899','#EF4444','#C8A35F','#6366F1','#A855F7','#F59E0B','#111827']
  ) AS s(days, emoji, color)
),
skill_badges AS (
  SELECT
    format('%s %s', level_code, skill_name) AS name,
    lower(format('%s-%s', level_code, skill_slug)) AS slug,
    format('Build %s skill mastery at %s level.', lower(skill_name), level_code) AS description,
    emoji,
    color,
    'emoji' AS icon_type,
    NULL::text AS icon_url,
    'skill' AS category,
    'automatic' AS trigger_type,
    jsonb_build_object('type', 'skill_mastery', 'level', level_code, 'skill', skill_slug) AS condition,
    true AS is_active
  FROM unnest(ARRAY['N5','N4','N3','N2','N1']) AS level_code
  CROSS JOIN unnest(
    ARRAY['Kana Specialist','Kanji Climber','Grammar Builder','Vocabulary Collector','Listening Tracker'],
    ARRAY['kana-specialist','kanji-climber','grammar-builder','vocabulary-collector','listening-tracker'],
    ARRAY['🎌','漢','📖','📝','🎧'],
    ARRAY['#D0021B','#7C3AED','#4F46E5','#0891B2','#D97706']
  ) AS sk(skill_name, skill_slug, emoji, color)
),
milestone_badges AS (
  SELECT
    name,
    slug,
    description,
    emoji,
    color,
    'emoji' AS icon_type,
    NULL::text AS icon_url,
    'milestone' AS category,
    'automatic' AS trigger_type,
    condition,
    true AS is_active
  FROM (VALUES
    ('First Lesson Complete','first-lesson-complete','Complete your first lesson.','🌱','#4CAF50', jsonb_build_object('type','lesson_total','count',1)),
    ('Five Lesson Focus','five-lesson-focus','Complete 5 lessons.','🧠','#2196F3', jsonb_build_object('type','lesson_total','count',5)),
    ('Ten Lesson Path','ten-lesson-path','Complete 10 lessons.','🛤️','#7C3AED', jsonb_build_object('type','lesson_total','count',10)),
    ('Twenty Lesson Push','twenty-lesson-push','Complete 20 lessons.','💪','#D0021B', jsonb_build_object('type','lesson_total','count',20)),
    ('Fifty Lesson Journey','fifty-lesson-journey','Complete 50 lessons.','🚀','#C8A35F', jsonb_build_object('type','lesson_total','count',50)),
    ('Hundred Lesson Scholar','hundred-lesson-scholar','Complete 100 lessons.','🎓','#111827', jsonb_build_object('type','lesson_total','count',100)),
    ('First Review Done','first-review-done','Complete your first review item.','🔁','#0891B2', jsonb_build_object('type','review_total','count',1)),
    ('Review Routine 10','review-routine-10','Complete 10 review items.','📚','#059669', jsonb_build_object('type','review_total','count',10)),
    ('Review Routine 50','review-routine-50','Complete 50 review items.','🧩','#8B5CF6', jsonb_build_object('type','review_total','count',50)),
    ('Review Routine 100','review-routine-100','Complete 100 review items.','🏆','#D97706', jsonb_build_object('type','review_total','count',100)),
    ('First 100 XP','first-100-xp','Earn 100 XP.','✨','#6366F1', jsonb_build_object('type','xp_total','count',100)),
    ('XP Builder 500','xp-builder-500','Earn 500 XP.','⚡','#A855F7', jsonb_build_object('type','xp_total','count',500)),
    ('XP Scholar 1000','xp-scholar-1000','Earn 1000 XP.','🌟','#F59E0B', jsonb_build_object('type','xp_total','count',1000)),
    ('Point Starter 50','point-starter-50','Earn 50 points.','💠','#0EA5E9', jsonb_build_object('type','points_total','count',50)),
    ('Point Collector 250','point-collector-250','Earn 250 points.','💎','#EC4899', jsonb_build_object('type','points_total','count',250)),
    ('Point Vault 1000','point-vault-1000','Earn 1000 points.','🏦','#EF4444', jsonb_build_object('type','points_total','count',1000)),
    ('First Practice Drill','first-practice-drill','Complete your first practice drill.','✍️','#D0021B', jsonb_build_object('type','practice_total','count',1)),
    ('Practice Habit 25','practice-habit-25','Complete 25 practice drills.','🎯','#4CAF50', jsonb_build_object('type','practice_total','count',25)),
    ('Daily Goal Starter','daily-goal-starter','Complete a daily learning goal.','☀️','#FF9800', jsonb_build_object('type','daily_goal_total','count',1)),
    ('Daily Goal Champion','daily-goal-champion','Complete 30 daily learning goals.','🏅','#C8A35F', jsonb_build_object('type','daily_goal_total','count',30))
  ) AS m(name, slug, description, emoji, color, condition)
),
special_badges AS (
  SELECT
    name,
    slug,
    description,
    emoji,
    color,
    'emoji' AS icon_type,
    NULL::text AS icon_url,
    'special' AS category,
    'manual_special' AS trigger_type,
    jsonb_build_object('type','manual_special') AS condition,
    true AS is_active
  FROM (VALUES
    ('Founding Learner','founding-learner','Special badge for early Japanese with Avnish learners.','🏯','#111827'),
    ('Community Helper','community-helper','Awarded for helping other learners.','🤝','#0891B2'),
    ('Feedback Contributor','feedback-contributor','Awarded for useful platform feedback.','💬','#D0021B'),
    ('Quiz Challenger','quiz-challenger','Awarded for strong placement quiz effort.','🧪','#7C3AED'),
    ('Writing Champion','writing-champion','Awarded for excellent writing practice.','✍️','#EC4899'),
    ('Listening Champion','listening-champion','Awarded for excellent listening practice.','🎧','#D97706'),
    ('Kanji Courage','kanji-courage','Awarded for consistent kanji effort.','漢','#4F46E5'),
    ('Comeback Learner','comeback-learner','Awarded for returning after a break.','🌅','#FF9800'),
    ('Premium Supporter','premium-supporter','Special badge for supporting the platform.','👑','#C8A35F'),
    ('Sensei Pick','sensei-pick','A manually awarded badge from the admin team.','⭐','#F59E0B')
  ) AS s(name, slug, description, emoji, color)
),
seed AS (
  SELECT * FROM level_badges
  UNION ALL SELECT * FROM streak_badges
  UNION ALL SELECT * FROM skill_badges
  UNION ALL SELECT * FROM milestone_badges
  UNION ALL SELECT * FROM special_badges
)
INSERT INTO badges (name, slug, description, emoji, color, icon_type, icon_url, category, trigger_type, condition, is_active)
SELECT name, slug, description, emoji, color, icon_type, icon_url, category, trigger_type, condition, is_active
FROM seed
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  emoji = EXCLUDED.emoji,
  color = EXCLUDED.color,
  icon_type = EXCLUDED.icon_type,
  icon_url = EXCLUDED.icon_url,
  category = EXCLUDED.category,
  trigger_type = EXCLUDED.trigger_type,
  condition = EXCLUDED.condition,
  is_active = EXCLUDED.is_active;
