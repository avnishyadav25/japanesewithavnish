-- What changed in each storyboard version.
--
-- `source` is too coarse to answer that: a re-cut, a rewrite and a preset switch are all just
-- 'human_edited' or 'regenerated', so a project with four versions showed four identical-looking
-- rows and no way to tell why any of them exists.
--
-- Written by whoever creates the version, because that is the only place the change is actually
-- known — "Repeat 2 -> 3" is a fact at the moment of the edit and only a guess afterwards. Versions
-- created before this column stay NULL, and the UI computes a diff for those instead.
ALTER TABLE video_storyboards
  ADD COLUMN IF NOT EXISTS change_summary TEXT;
