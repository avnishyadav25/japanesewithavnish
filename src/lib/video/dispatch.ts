/**
 * Wakes a remote render worker.
 *
 * The queue is durable, so this is purely a latency optimisation: without it a GitHub Actions
 * worker picks the job up at its next scheduled tick (up to 15 minutes), and a local worker
 * picks it up within 5 seconds. A dispatch failure is therefore never fatal — the caller
 * reports it and moves on.
 *
 * `repository_dispatch` is the right GitHub API here rather than `workflow_dispatch`: it does
 * not require the workflow file to already exist on the default branch under a specific name,
 * and it carries a payload for debugging which project triggered the run.
 */
const GITHUB_API = "https://api.github.com";

export interface DispatchResult {
  attempted: boolean;
  ok: boolean;
  detail: string;
}

/**
 * Fires a workflow by `repository_dispatch`.
 *
 * `eventType` is a parameter because there are now two workflows: renders, and script generation
 * for scopes too large to finish inside a serverless request. Both are woken the same way and both
 * re-derive their work from the database — the payload is a breadcrumb for debugging, not input.
 */
export async function triggerWorkflow(
  eventType: "video-render" | "video-script",
  payload: Record<string, unknown>
): Promise<DispatchResult> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_DISPATCH_REPO;

  if (!token || !repo) {
    return {
      attempted: false,
      ok: false,
      detail:
        eventType === "video-script"
          ? "No GitHub dispatch configured — run `npm run video:script -- --project=<id>` locally instead."
          : "No GitHub dispatch configured — a running local worker will pick this up within seconds, otherwise it waits for the scheduled run.",
    };
  }

  try {
    const res = await fetch(`${GITHUB_API}/repos/${repo}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_type: eventType,
        client_payload: payload,
      }),
      // Netlify functions have roughly ten seconds total; never let a slow GitHub API call
      // be the thing that times out a request whose real work is already committed.
      signal: AbortSignal.timeout(5000),
    });

    if (res.status === 204) return { attempted: true, ok: true, detail: "GitHub Actions worker triggered." };
    return {
      attempted: true,
      ok: false,
      detail: `GitHub dispatch returned ${res.status}. The job is queued and will still be picked up.`,
    };
  } catch (err) {
    return {
      attempted: true,
      ok: false,
      detail: `GitHub dispatch failed (${err instanceof Error ? err.message : "unknown"}). The job is queued and will still be picked up.`,
    };
  }
}

/**
 * Wakes the render worker. Thin wrapper kept so the three existing call sites are unchanged.
 *
 * The empty-formats guard lives here rather than in triggerWorkflow: "nothing was newly queued"
 * is a render-specific concept, and a script dispatch has no equivalent.
 */
export async function triggerRemoteWorker(payload: {
  projectId: string;
  storyboardId: string;
  formats: string[];
}): Promise<DispatchResult> {
  if (payload.formats.length === 0) {
    return { attempted: false, ok: true, detail: "Nothing newly queued; no dispatch needed." };
  }
  return triggerWorkflow("video-render", payload);
}
