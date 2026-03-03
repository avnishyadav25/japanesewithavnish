import { sql } from "@/lib/db";

const MAX_PROMPT = 8000;
const MAX_RESULT = 2000;

export type LogEntry = {
  log_type: string;
  content_type: string;
  entity_type?: string | null;
  entity_id?: string | null;
  model_used: string;
  prompt_sent?: string | null;
  result_preview?: string | null;
  result_metadata?: Record<string, unknown> | null;
  admin_email?: string | null;
  created_at: string;
};

export async function insertAiLog(params: {
  log_type: string;
  content_type: string;
  entity_type?: string | null;
  entity_id?: string | null;
  model_used: string;
  prompt_sent?: string | null;
  result_preview?: string | null;
  result_metadata?: Record<string, unknown> | null;
  admin_email?: string | null;
}): Promise<void> {
  if (!sql) return;
  try {
    const prompt_sent = params.prompt_sent != null ? String(params.prompt_sent).slice(0, MAX_PROMPT) : null;
    const result_preview = params.result_preview != null ? String(params.result_preview).slice(0, MAX_RESULT) : null;
    await sql`
      INSERT INTO ai_generation_logs (log_type, content_type, entity_type, entity_id, model_used, prompt_sent, result_preview, result_metadata, admin_email)
      VALUES (${params.log_type}, ${params.content_type}, ${params.entity_type ?? null}, ${params.entity_id ?? null}, ${params.model_used}, ${prompt_sent}, ${result_preview}, ${params.result_metadata ?? null}, ${params.admin_email ?? null})
    `;
  } catch (e) {
    console.error("AI log insert:", e);
  }
}
