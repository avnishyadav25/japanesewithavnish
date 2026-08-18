import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { listVariantHistory, restoreVariantVersion } from "@/lib/social/briefs";

/**
 * Earlier drafts of one surface, and restoring one.
 *
 * These rows have always existed — saveVariant supersedes by flipping `is_current` and inserting a
 * new row, and deletes nothing — but the workspace only ever loaded the current one. So a
 * regenerate that produced worse copy than the attempt before it was unrecoverable without a SQL
 * client, even though the better version was sitting right there.
 *
 * Keyed off a variant id rather than (brief, surface, lang) because that is what the UI already
 * holds for the card you are looking at.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const rows = (await sql`
    SELECT brief_id, surface, lang FROM social_variants WHERE id = ${id}::uuid
  `) as { brief_id: string; surface: string; lang: string }[];
  if (!rows[0]) return NextResponse.json({ error: "Variant not found" }, { status: 404 });

  const history = await listVariantHistory(rows[0].brief_id, rows[0].surface, rows[0].lang);

  return NextResponse.json({
    surface: rows[0].surface,
    lang: rows[0].lang,
    versions: history.map((v) => ({
      id: v.id,
      version: v.version,
      isCurrent: v.isCurrent,
      source: v.source,
      approvalStatus: v.approvalStatus,
      createdAt: v.createdAt,
      // A preview rather than the whole document: this list exists to help you recognise a
      // version, not to read it. Restoring it and looking is the way to read it.
      preview: Object.values(v.content ?? {})
        .filter((x): x is string => typeof x === "string")
        .join(" · ")
        .slice(0, 220),
      mediaCount: (v.media ?? []).length,
    })),
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const restoreId = typeof body?.versionId === "string" ? body.versionId : id;

  try {
    const restored = await restoreVariantVersion(restoreId);
    return NextResponse.json({
      variant: restored,
      message: `Version ${restored.version} is current again. Nothing was deleted — the others are still here.`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not restore that version" },
      { status: 400 }
    );
  }
}
