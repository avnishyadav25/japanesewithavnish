import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

/**
 * The reusable sticker / character / texture library.
 *
 * `video_assets` was written by `npm run video:assets -- --promote` and read by NOTHING — no route,
 * no page, no renderer. Forty-odd images were generated, reviewed and uploaded to R2, and then
 * decorated exactly zero videos. This route is the missing half.
 *
 * Deliberately not paginated: the library is dozens of rows, not thousands, and the gallery wants
 * them all at once so the category counts in the filter pills are real rather than "of the page
 * you happen to be on".
 */
export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const rows = (await sql`
    SELECT id, slug, category, label, url, width, height, tags, is_enabled, created_at::text AS created_at
    FROM video_assets
    ORDER BY category, slug
  `) as {
    id: string;
    slug: string;
    category: string;
    label: string;
    url: string;
    width: number | null;
    height: number | null;
    tags: string[] | null;
    is_enabled: boolean;
    created_at: string;
  }[];

  return NextResponse.json({
    assets: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      category: r.category,
      label: r.label,
      url: r.url,
      width: r.width,
      height: r.height,
      tags: r.tags ?? [],
      isEnabled: r.is_enabled,
      createdAt: r.created_at,
    })),
  });
}

/**
 * Enable or disable one asset.
 *
 * Disable rather than delete, for the same reason the BGM library disables tracks: a storyboard
 * freezes the asset it chose, so removing the row would leave a rendered video pointing at an
 * object that still exists in R2 but has no record of where it came from. Disabling stops it being
 * picked for anything NEW and leaves history intact.
 */
export async function PATCH(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const rows = (await sql`
    UPDATE video_assets SET is_enabled = ${body?.isEnabled !== false} WHERE id = ${id}::uuid
    RETURNING id, slug, is_enabled
  `) as { id: string; slug: string; is_enabled: boolean }[];
  if (!rows[0]) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  return NextResponse.json({
    id: rows[0].id,
    isEnabled: rows[0].is_enabled,
    message: `${rows[0].slug} ${rows[0].is_enabled ? "will be used in new videos" : "will not be used in new videos"}. Existing renders are unchanged.`,
  });
}
