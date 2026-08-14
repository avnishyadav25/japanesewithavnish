import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { importLegacyPack } from "@/lib/social/importLegacy";

/** Lifts a legacy `social_content_packs` row into a brief. Idempotent — a second call returns
 *  the existing brief rather than duplicating it. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { id } = await params;
  try {
    const result = await importLegacyPack(id, admin.email);
    return NextResponse.json({
      ...result,
      notice: result.alreadyImported
        ? "This pack was already imported — opening the existing brief."
        : `Imported ${result.imported.length} surface${result.imported.length === 1 ? "" : "s"}. ` +
          `${result.skipped.length} had nothing in the pack and were left empty, not faked — generate those.`,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Import failed" }, { status: 400 });
  }
}
