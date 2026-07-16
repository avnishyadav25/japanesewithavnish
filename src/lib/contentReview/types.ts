// Shared types for the Content Review Center (Phase 1).
// Scoped to the 7 posts-backed content types with no prior review mechanism — deliberately
// excludes curriculum_lessons/lesson_blocks, which keep their own existing review_status gate.

export const REVIEW_ENTITY_TYPES = [
  "vocabulary",
  "grammar",
  "kanji",
  "reading",
  "listening",
  "writing",
  "sounds",
  // Gap-fix phase 10 (mock test scope decision): accepted here so the system is ready the
  // moment practice_test has real content, but deliberately has no dedicated agent, sidecar
  // table, or fetchSidecar() branch — there are zero practice_test posts and no supporting
  // schema anywhere in this codebase today (confirmed by direct query), so building checks
  // against an undefined data model would be pure speculation. A practice_test post reviewed
  // today correctly hard-fails deterministic validation ("no matching sidecar row") rather
  // than silently no-op'ing or crashing — build real coverage once the feature itself exists.
  "practice_test",
] as const;

export type ReviewEntityType = (typeof REVIEW_ENTITY_TYPES)[number];

export function isReviewEntityType(value: string): value is ReviewEntityType {
  return (REVIEW_ENTITY_TYPES as readonly string[]).includes(value);
}

export const REVIEW_SEVERITIES = ["critical", "major", "minor", "suggestion", "info"] as const;
export type ReviewSeverity = (typeof REVIEW_SEVERITIES)[number];

export const REVIEW_STATES = [
  "not_reviewed",
  "queued",
  "validating",
  "validation_failed",
  "ai_reviewing",
  "needs_human_review",
  "changes_requested",
  "approved",
  "publish_ready",
  "published",
  "rejected",
  "archived",
] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

export const JOB_STATUSES = ["queued", "claimed", "running", "completed", "failed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const FINDING_STATUSES = ["open", "accepted", "rejected", "fixed", "false_positive"] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

export const AGENT_KEYS = [
  "metadata_taxonomy",
  "japanese_language",
  "level_alignment",
  "practice_answer",
  "content_type_specialist",
  "final_aggregator",
  // Phase 2 — dedicated per-type reviewers (replace content_type_specialist for these 5 types)
  "grammar_reviewer",
  "vocabulary_reviewer",
  "kanji_reviewer",
  "reading_reviewer",
  "listening_reviewer",
  // Gap-fix phase 9 — the last 2 content_type_specialist types get their own dedicated
  // reviewers (content_type_specialist is fully superseded, disabled rather than deleted),
  // plus 2 new cross-type specialists and trust_claims split out of level_alignment.
  "writing_reviewer",
  "kana_pronunciation_reviewer",
  "example_sentence_reviewer",
  "seo_reviewer",
  "trust_claims_reviewer",
] as const;
export type AgentKey = (typeof AGENT_KEYS)[number];

/** One finding as produced by an agent, before it has a DB id. */
export interface DraftFinding {
  severity: ReviewSeverity;
  category: string;
  fieldName?: string | null;
  originalValue?: unknown;
  suggestedValue?: unknown;
  title: string;
  description: string;
  /** Gap-fix phase 17: distinct from description — description explains WHAT is wrong,
   * whyItMatters explains the learner-facing consequence of leaving it unfixed. Optional
   * since not every agent/prompt has been asked for it (deterministic checks may omit it). */
  whyItMatters?: string | null;
}

/** A finding row as stored/returned from content_review_findings. */
export interface Finding extends DraftFinding {
  id: string;
  reviewRunId: string;
  agentKey: string;
  status: FindingStatus;
  createdAt: string;
}

export interface ContentReviewJob {
  id: string;
  entityType: ReviewEntityType;
  entityId: string;
  triggerType: "manual_single" | "bulk_sweep" | "content_edit";
  status: JobStatus;
  requestedAgentKeys: string[] | null;
  attemptCount: number;
  maxAttempts: number;
  errorMessage: string | null;
  requestedBy: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ContentReviewRun {
  id: string;
  jobId: string | null;
  entityType: ReviewEntityType;
  entityId: string;
  overallStatus: "pending" | "validation_failed" | "completed" | "error";
  publishReady: boolean;
  overallScore: number | null;
  categoryScores: Record<string, number> | null;
  summary: string | null;
  agentKeysRun: string[] | null;
  createdAt: string;
  completedAt: string | null;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

/** Result of a single agent's pass over one content snapshot. */
export interface AgentResult {
  agentKey: AgentKey;
  findings: DraftFinding[];
  /** Set when a hard deterministic failure means no further agents should run. */
  hardFail?: { reason: string };
  /** Absent for deterministic agents (practice_answer) that never call the LLM. */
  usage?: TokenUsage;
}

/** The joined post + sidecar (+ practice) data an agent reads. Shape varies by entityType. */
export type ContentSnapshot = {
  entityType: ReviewEntityType;
  entityId: string;
  post: {
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    content: string | null;
    jlptLevel: string[] | null;
    tags: string[] | null;
    contentType: string;
    status: string;
    // Gap-fix phase 9: added for seo_reviewer. Note this changes checksumSnapshot()'s output
    // for every post the first time it's re-snapshotted — expected, since a post literally
    // hasn't been checked against these fields before now, so treating it as "changed" and
    // eligible for re-review (via scheduledReReview.ts / queueReReviewOnEdit) is correct.
    seoTitle: string | null;
    seoDescription: string | null;
    ogImageUrl: string | null;
    canonicalUrl: string | null;
  };
  sidecar: Record<string, unknown> | null;
  practice?: unknown;
};
