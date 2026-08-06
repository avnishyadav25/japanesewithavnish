import { sql } from "@/lib/db";

/**
 * Durable, per-key rate limit backed by Postgres (see migration 133_rate_limits.sql).
 * Fails OPEN (returns allowed: true) if the DB is unavailable or the table doesn't exist
 * yet — a rate limiter should never be the reason a legitimate user's form submission
 * silently breaks in production.
 */
export async function checkRateLimit(
  key: string,
  { max, windowMs }: { max: number; windowMs: number }
): Promise<{ allowed: boolean }> {
  if (!sql) return { allowed: true };
  try {
    const now = new Date();
    const resetAt = new Date(now.getTime() + windowMs);
    const rows = (await sql`
      INSERT INTO rate_limits (key, count, reset_at)
      VALUES (${key}, 1, ${resetAt.toISOString()})
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN rate_limits.reset_at < ${now.toISOString()} THEN 1
          ELSE rate_limits.count + 1
        END,
        reset_at = CASE
          WHEN rate_limits.reset_at < ${now.toISOString()} THEN ${resetAt.toISOString()}
          ELSE rate_limits.reset_at
        END
      RETURNING count
    `) as { count: number }[];
    const count = rows[0]?.count ?? 1;
    return { allowed: count <= max };
  } catch (err) {
    console.error(`[rate-limit] check failed for key "${key}", failing open:`, err);
    return { allowed: true };
  }
}

/** Best-effort client IP extraction across Netlify/Vercel proxy headers. */
export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-nf-client-connection-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
