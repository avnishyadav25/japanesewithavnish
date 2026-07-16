import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { REVIEW_ENTITY_TYPES } from "@/lib/contentReview/types";
import { recordAgentVersion } from "@/lib/contentReview/agentVersions";

export async function PATCH(req: Request, { params }: { params: Promise<{ agentKey: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { agentKey } = await params;
  const body = await req.json().catch(() => null);

  const isEnabled = typeof body?.isEnabled === "boolean" ? body.isEnabled : undefined;
  const modelName = typeof body?.modelName === "string" && body.modelName.trim() ? body.modelName.trim() : undefined;
  const temperature = typeof body?.temperature === "number" && body.temperature >= 0 && body.temperature <= 2 ? body.temperature : undefined;
  const scope = Array.isArray(body?.scope) && body.scope.every((s: unknown) => typeof s === "string" && (REVIEW_ENTITY_TYPES as readonly string[]).includes(s))
    ? body.scope
    : undefined;

  const existing = await sql`SELECT agent_key, is_enabled, model_name, temperature, scope FROM content_review_agents WHERE agent_key = ${agentKey}`;
  const current = existing[0] as { is_enabled: boolean; model_name: string; temperature: number; scope: string[] } | undefined;
  if (!current) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  await sql`
    UPDATE content_review_agents SET
      is_enabled = ${isEnabled ?? current.is_enabled},
      model_name = ${modelName ?? current.model_name},
      temperature = ${temperature ?? current.temperature},
      scope = ${scope ?? current.scope},
      updated_at = NOW()
    WHERE agent_key = ${agentKey}
  `;
  await recordAgentVersion(agentKey, admin.email);

  return NextResponse.json({ success: true });
}
