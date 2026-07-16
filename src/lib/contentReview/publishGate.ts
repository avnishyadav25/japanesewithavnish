import { sql } from "@/lib/db";

export interface PublishGateStatus {
  blocked: boolean;
  reasons: string[];
  openCriticalFindings: { id: string; title: string; description: string }[];
}

const MIN_SCORE = 80;
const APPROVED_STATES = new Set(["approved", "publish_ready", "published"]);

/** Soft-block check against all 5 conditions from the spec:
 *  overallScore >= 80 AND criticalIssueCount === 0 AND requiredAgentFailures === 0 AND
 *  validationPassed === true AND humanApprovalComplete === true.
 * Still a soft block with override (not a hard lock) — this is a flat single-admin site;
 * a non-overridable "every post needs an explicit human approval before it can publish"
 * requirement would immediately block publishing on all ~8,900 posts that predate this
 * system and have never been reviewed. Always re-queries live state off the post's current
 * run — never trusts content_review_runs.publish_ready, which is a stale point-in-time flag. */
export async function getPublishGateStatus(postId: string): Promise<PublishGateStatus> {
  if (!sql) return { blocked: false, reasons: [], openCriticalFindings: [] };

  const postRows = (await sql`
    SELECT p.review_state, r.overall_score, r.overall_status, r.failed_agent_keys
    FROM posts p
    LEFT JOIN content_review_runs r ON r.id = p.last_review_run_id
    WHERE p.id = ${postId}
  `) as { review_state: string; overall_score: number | null; overall_status: string | null; failed_agent_keys: string[] | null }[];

  const post = postRows[0];
  // No review run at all yet (brand-new content, or never reviewed) — vacuously unblocked,
  // same as Phase 1: this system blocks *re*-publishing content with known problems, it
  // doesn't force review-before-first-publish.
  if (!post || post.overall_status === null) return { blocked: false, reasons: [], openCriticalFindings: [] };

  const openCriticalFindings = (await sql`
    SELECT f.id, f.title, f.description
    FROM posts p
    JOIN content_review_findings f ON f.review_run_id = p.last_review_run_id
    WHERE p.id = ${postId} AND f.severity = 'critical' AND f.status = 'open'
  `) as { id: string; title: string; description: string }[];

  const reasons: string[] = [];
  if (openCriticalFindings.length > 0) reasons.push(`${openCriticalFindings.length} open critical finding(s)`);
  if (post.overall_status === "validation_failed") reasons.push("content failed deterministic validation");
  if (post.overall_score != null && post.overall_score < MIN_SCORE) reasons.push(`quality score ${post.overall_score} is below the ${MIN_SCORE} minimum`);
  if (post.failed_agent_keys && post.failed_agent_keys.length > 0) reasons.push(`required agent(s) failed to run: ${post.failed_agent_keys.join(", ")}`);
  if (!APPROVED_STATES.has(post.review_state)) reasons.push(`not yet approved by a human (current state: ${post.review_state})`);

  return { blocked: reasons.length > 0, reasons, openCriticalFindings };
}
