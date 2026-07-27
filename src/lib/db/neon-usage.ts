export interface NeonUsage {
  computeHoursUsed: number | null;
  computeHoursLimit: number | null;
  raw?: unknown;
}

/** Best-effort — the exact consumption-metrics fields aren't verified against a live
 * key yet (NEON_API_KEY isn't configured). If Neon's response shape doesn't match
 * once real credentials are added, adjust the field paths below; the status endpoint
 * treats any failure here as "usage unavailable" rather than failing the whole request. */
export async function fetchNeonUsage(): Promise<NeonUsage | null> {
  const apiKey = process.env.NEON_API_KEY;
  const projectId = process.env.NEON_PROJECT_ID;
  if (!apiKey || !projectId) return null;

  try {
    const res = await fetch(`https://console.neon.tech/api/v2/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    const project = data.project ?? data;
    return {
      computeHoursUsed: null,
      computeHoursLimit: project?.compute_hours_limit ?? null,
      raw: project,
    };
  } catch {
    return null;
  }
}
