// No delimiter/isolation convention exists anywhere else in this codebase for splicing
// DB/content-derived text into an LLM prompt — this is new, and load-bearing for review
// agents specifically, since they are handed arbitrary (sometimes learner-submitted)
// content to analyze rather than trusted, developer-authored context.
const OPEN_MARKER = "<<<REVIEW_CONTENT";
const CLOSE_MARKER = "<<<END_REVIEW_CONTENT>>>";

// Gap-fix phase 26: input-size cap. ~20k chars (~5k tokens) is generous for any real lesson
// field but bounds worst-case prompt size/cost against a pathologically large value (bad
// import, a learner-submitted field, a runaway content field). Truncated INSIDE the wrapped
// content (not silently) so the agent's own findings honestly account for not having seen
// the full field, rather than the agent judging content it never actually read.
const MAX_FIELD_CHARS = 20_000;

/** Neutralizes any literal occurrence of the delimiter tokens already present in the
 * content being wrapped, so the content itself can't fake a premature close/reopen. */
function neutralizeDelimiters(value: string): string {
  return value.split(OPEN_MARKER).join("< <<REVIEW_CONTENT").split(CLOSE_MARKER).join("< <<END_REVIEW_CONTENT>>>");
}

/** Wraps one field of untrusted reviewed content in explicit markers. The agent prompts
 * (content_review_shared_policy) instruct the model that everything between these markers
 * is data to analyze, never instructions to follow. */
export function wrapUntrustedContent(fieldLabel: string, value: unknown): string {
  if (value === null || value === undefined) return `${OPEN_MARKER} field="${fieldLabel}" untrusted="true">>>\n(none)\n${CLOSE_MARKER}`;
  let text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  if (text.length > MAX_FIELD_CHARS) {
    text = `${text.slice(0, MAX_FIELD_CHARS)}\n[...TRUNCATED: ${text.length - MAX_FIELD_CHARS} more characters not shown...]`;
  }
  return `${OPEN_MARKER} field="${fieldLabel}" untrusted="true">>>\n${neutralizeDelimiters(text)}\n${CLOSE_MARKER}`;
}
