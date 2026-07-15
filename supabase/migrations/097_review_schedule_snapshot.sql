-- Ad-hoc tutor answers ("Save to Review" / "Create Flashcard" from Nihongo Navi)
-- don't correspond to a real post/lesson row, so store a text snapshot instead of
-- relying on the item_id -> posts/curriculum_lessons join the rest of review_schedule uses.
ALTER TABLE review_schedule ADD COLUMN IF NOT EXISTS snapshot_title TEXT;
ALTER TABLE review_schedule ADD COLUMN IF NOT EXISTS snapshot_content TEXT;
