import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { validateBlockData, type BlockType } from "@/lib/blocks/blockTypes";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; blockId: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id: lessonId, blockId } = await params;
  const body = await req.json();

  const existingRows = await sql`SELECT block_type FROM lesson_blocks WHERE id = ${blockId} AND lesson_id = ${lessonId}`;
  const existing = (existingRows as { block_type: BlockType }[])[0];
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.block_data !== undefined) {
    const errors = validateBlockData(existing.block_type, body.block_data);
    if (errors.length > 0) {
      return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 });
    }
  }

  const blockDataVal = body.block_data !== undefined ? JSON.stringify(body.block_data) : null;
  const sortOrderVal = typeof body.sort_order === "number" ? body.sort_order : null;
  const BLOCK_ACCESS_TIERS = ["public", "free_account", "daily_unlocked", "premium", "preview"];
  const blockAccessVal = BLOCK_ACCESS_TIERS.includes(body.block_access) ? body.block_access : null;
  // Saving validated block_data with no explicit status auto-publishes it — there's no
  // separate publish action in the admin UI, so a successful content save is the publish signal.
  const statusVal =
    body.status === "draft" || body.status === "published"
      ? body.status
      : body.block_data !== undefined
        ? "published"
        : null;

  // A manual save-and-publish through the regular editor counts as the admin having reviewed
  // the content, so clear a pending AI review-gate flag rather than leaving it stuck in the queue.
  const rows = await sql`
    UPDATE lesson_blocks SET
      block_data = COALESCE(${blockDataVal}::jsonb, block_data),
      sort_order = COALESCE(${sortOrderVal}, sort_order),
      status = COALESCE(${statusVal}, status),
      block_access = COALESCE(${blockAccessVal}, block_access),
      review_status = CASE WHEN ${statusVal} = 'published' AND review_status = 'pending' THEN 'approved' ELSE review_status END,
      reviewed_by = CASE WHEN ${statusVal} = 'published' AND review_status = 'pending' THEN ${admin.email} ELSE reviewed_by END,
      reviewed_at = CASE WHEN ${statusVal} = 'published' AND review_status = 'pending' THEN NOW() ELSE reviewed_at END,
      updated_at = NOW()
    WHERE id = ${blockId} AND lesson_id = ${lessonId}
    RETURNING id, lesson_id, block_type, block_data, sort_order, status, block_access
  `;
  return NextResponse.json((rows as unknown[])[0]);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; blockId: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id: lessonId, blockId } = await params;
  const result = await sql`DELETE FROM lesson_blocks WHERE id = ${blockId} AND lesson_id = ${lessonId} RETURNING id`;
  if (!(result as unknown[])?.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
