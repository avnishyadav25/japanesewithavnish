import { sql } from "@/lib/db";

export type ErrorLogSource =
  | "sign-in"
  | "sign-up"
  | "forgot-password"
  | "reset-password"
  | "ai-tutor"
  | "ai-next-steps"
  | "ai-daily-checkpoint"
  | "other";

export async function logError(
  source: ErrorLogSource,
  message: string,
  details?: Record<string, unknown>
): Promise<void> {
  if (!sql) return;
  try {
    await sql`
      INSERT INTO error_log (source, message, details)
      VALUES (${source}, ${message}, ${details ? JSON.stringify(details) : null})
    `;
  } catch (e) {
    console.error("[error-log] Failed to persist:", e);
  }
}
