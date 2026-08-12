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

export async function triggerRemoteWorker(payload: {
  projectId: string;
  storyboardId: string;
  formats: string[];
}): Promise<DispatchResult> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_DISPATCH_REPO;

  if (!token || !repo) {
    return {
      attempted: false,
      ok: false,
      detail:
        "No GitHub dispatch configured — a running local worker will pick this up within seconds, otherwise it waits for the scheduled run.",
    };
  }
  if (payload.formats.length === 0) {
    return { attempted: false, ok: true, detail: "Nothing newly queued; no dispatch needed." };
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
        event_type: "video-render",
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
