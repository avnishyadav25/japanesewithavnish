-- Which format template a project was created from.
--
-- Templates (src/lib/video/templates.ts) define what a format IS — items per video, pacing, whether
-- it ends with a recall round, which motion profile it renders under. Without this column the
-- template is applied once at creation and then forgotten, so a regenerate silently reverts to
-- generic defaults and the recall round quietly disappears.
--
-- That failure mode is well attested in this codebase: four fields have shipped declared-and-ignored
-- (Scene.pacingOverride, VocabListVisual.highlightSchedule, BLOCK_TYPE_TO_SCENE, and
-- QuizQuestionVisual.thinkingSeconds). Storing the id is what keeps this one honest.
ALTER TABLE video_projects
  ADD COLUMN IF NOT EXISTS template_id TEXT;
