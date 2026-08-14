import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { getVariant, setVariantApproval, updateVariantContent } from "@/lib/social/briefs";
import { enforceSurface } from "@/lib/social/clamp";
import type { SurfaceContent } from "@/lib/social/types";

/**
 * Hand-edit a variant, or approve/reject it.
 *
 * Edits go through the same `enforceSurface()` pass a generated variant does. A human is just as
 * capable of pasting 340 characters into a field capped at 280, and the clamp report is what the
 * UI renders to say so — the limits should not be enforced only against the model.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const variant = await getVariant(id);
  if (!variant) return NextResponse.json({ error: "Variant not found" }, { status: 404 });

  const body = await req.json().catch(() => null);

  if (body?.decision === "approved" || body?.decision === "rejected") {
    await setVariantApproval(id, body.decision, admin.email);
    return NextResponse.json({ variant: await getVariant(id) });
  }

  const content = (body?.content ?? variant.content) as SurfaceContent;
  const hashtags = Array.isArray(body?.hashtags)
    ? (body.hashtags as unknown[]).filter((h): h is string => typeof h === "string")
    : variant.hashtags;

  const enforced = enforceSurface(variant.surface, variant.lang, { content, hashtags });
  const updated = await updateVariantContent(id, enforced.content, enforced.hashtags, enforced.violations, admin.email);

  return NextResponse.json({ variant: updated, violations: enforced.violations, rejected: enforced.rejected });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const variant = await getVariant(id);
  if (!variant) return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  return NextResponse.json({ variant });
}
