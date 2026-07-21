import { sql } from "@/lib/db";

/** Best-effort login tracking, called from every session-issuing route (password sign-in,
 * magic-link callback, OAuth callback). Never throws — a logging failure must not block login. */
export async function recordLoginEvent(email: string, req: Request): Promise<void> {
  if (!sql) return;
  try {
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = req.headers.get("user-agent") || null;
    await sql`INSERT INTO user_login_events (user_email, ip_address, user_agent) VALUES (${email}, ${ipAddress}, ${userAgent})`;
    await sql`UPDATE profiles SET last_login_at = NOW(), updated_at = NOW() WHERE email = ${email}`;
  } catch {
    // best-effort; ignore if tables/columns missing or write fails
  }
}
