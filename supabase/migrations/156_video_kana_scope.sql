-- Allow the `kana_set` scope kind.
--
-- The TypeScript ScopeKind union gained `kana_set` when the kana resolver landed, and the database
-- CHECK did not — so every kana project failed at INSERT with a constraint violation while tsc,
-- lint and the build were all green. Twenty-two of them, in one run.
--
-- The same split-brain shape this project keeps producing: a value declared in one place and
-- unknown in another. A scope kind lives in BOTH the union and this constraint.
ALTER TABLE video_projects DROP CONSTRAINT IF EXISTS video_projects_scope_kind_check;
ALTER TABLE video_projects
  ADD CONSTRAINT video_projects_scope_kind_check
  CHECK (scope_kind IN (
    'curriculum_level', 'curriculum_module', 'curriculum_submodule', 'curriculum_lesson',
    'content_batch', 'content_item', 'topic',
    -- Reads the `kana` table directly. Kana has no post_id, so it can reach nothing through posts.
    'kana_set'
  ));
