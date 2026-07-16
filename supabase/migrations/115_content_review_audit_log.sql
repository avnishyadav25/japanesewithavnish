-- Gap-fix phase 20: Audit Log. content_review_decisions already logs who decided what on a
-- finding, and review_agent_versions (migration 114) already logs agent config/prompt
-- changes — but posts.review_state transitions from Approve/Request Changes/Archive
-- (single-item and bulk) had zero actor/timestamp trail at all (a blind UPDATE with no log
-- row). This generic append-only event log closes that gap so admin state-change actions are
-- auditable too; the Audit Log page unions all three sources into one chronological feed.
SET search_path TO public;

CREATE TABLE IF NOT EXISTS content_review_audit_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor        TEXT NOT NULL,
  action       TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    UUID NOT NULL,
  detail       JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_content_review_audit_log_created ON content_review_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_review_audit_log_entity ON content_review_audit_log(entity_type, entity_id);
