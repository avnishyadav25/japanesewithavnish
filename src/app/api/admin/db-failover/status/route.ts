import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { getFailoverStatus } from "@/lib/db/health";
import { fetchNeonUsage } from "@/lib/db/neon-usage";
import { fetchSupabaseUsage } from "@/lib/db/supabase-usage";
import { diffSchemas, fetchNeonSchema, fetchSupabaseSchema } from "@/lib/db/schema-parity";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = await getFailoverStatus();

  const [neonUsage, supabaseUsage] = await Promise.all([fetchNeonUsage(), fetchSupabaseUsage()]);

  let schemaParity: { ok: boolean; missingInSupabase: string[]; missingInNeon: string[]; mismatchCount: number } | { error: string } = {
    error: "Not checked (requires both providers configured)",
  };
  if (status.providers.neon.configured && status.providers.supabase.configured) {
    try {
      const [neonSchema, supabaseSchema] = await Promise.all([fetchNeonSchema(), fetchSupabaseSchema()]);
      const diff = diffSchemas(neonSchema, supabaseSchema);
      schemaParity = {
        ok: diff.ok,
        missingInSupabase: diff.missingInSupabase,
        missingInNeon: diff.missingInNeon,
        mismatchCount: diff.columnMismatches.length,
      };
    } catch (e) {
      schemaParity = { error: e instanceof Error ? e.message : "Schema parity check failed" };
    }
  }

  return NextResponse.json({ ...status, schemaParity, usage: { neon: neonUsage, supabase: supabaseUsage } });
}
