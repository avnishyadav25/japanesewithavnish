import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { isAllowedPromptKey } from "@/lib/ai/load-prompts";

type PromptRow = { key: string; content: string; updated_at: string };

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const rows = await sql`
      SELECT key, content, updated_at::text AS updated_at FROM ai_prompts ORDER BY key
    ` as PromptRow[];
    return NextResponse.json({ prompts: rows ?? [] });
  } catch (e) {
    console.error("Admin prompts GET:", e);
    return NextResponse.json({ error: "Failed to load prompts" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const body = await req.json().catch(() => ({}));
    const { key, content } = body as { key?: string; content?: string };
    if (typeof key !== "string" || !key.trim()) {
      return NextResponse.json({ error: "key required" }, { status: 400 });
    }
    const trimmedKey = key.trim();
    if (!isAllowedPromptKey(trimmedKey)) {
      return NextResponse.json({ error: "Invalid prompt key" }, { status: 404 });
    }
    const trimmedContent = typeof content === "string" ? content.trim() : "";
    if (!trimmedContent) {
      return NextResponse.json({ error: "content must be non-empty" }, { status: 400 });
    }

    const result = await sql`
      UPDATE ai_prompts SET content = ${trimmedContent}, updated_at = NOW() WHERE key = ${trimmedKey} RETURNING key, content, updated_at::text AS updated_at
    ` as PromptRow[];
    if (!result?.length) {
      return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
    }
    return NextResponse.json({ prompt: result[0] });
  } catch (e) {
    console.error("Admin prompts PATCH:", e);
    return NextResponse.json({ error: "Failed to update prompt" }, { status: 500 });
  }
}
