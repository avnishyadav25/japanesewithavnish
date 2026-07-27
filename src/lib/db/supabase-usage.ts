export interface SupabaseUsage {
  raw?: unknown;
}

/** Best-effort — the exact usage-metrics endpoint/fields aren't verified against a live
 * token yet (SUPABASE_ACCESS_TOKEN isn't configured). Adjust once real credentials are
 * added; the status endpoint treats any failure here as "usage unavailable". */
export async function fetchSupabaseUsage(): Promise<SupabaseUsage | null> {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef = process.env.SUPABASE_PROJECT_REF;
  if (!accessToken || !projectRef) return null;

  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { raw: data };
  } catch {
    return null;
  }
}
