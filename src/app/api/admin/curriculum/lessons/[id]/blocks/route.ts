import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { ALL_BLOCK_TYPES, type BlockType } from "@/lib/blocks/blockTypes";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id: lessonId } = await params;
  const rows = await sql`
    SELECT id, lesson_id, block_type, block_data, sort_order, status, block_access, review_status, generated_by_model, created_at, updated_at
    FROM lesson_blocks
    WHERE lesson_id = ${lessonId}
    ORDER BY sort_order, created_at
  `;
  return NextResponse.json(rows);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const { id: lessonId } = await params;
  const body = await req.json();
  const blockType = body.block_type as BlockType;
  if (!ALL_BLOCK_TYPES.includes(blockType)) {
    return NextResponse.json({ error: "Invalid block_type" }, { status: 400 });
  }
  // New blocks start empty and get filled in via the edit form, so creation is not
  // strictly validated here — validateBlockData runs on PATCH when the author saves content.
  const blockData = body.block_data && typeof body.block_data === "object" ? body.block_data : {};

  const maxSortRows = await sql`SELECT COALESCE(MAX(sort_order), 0) AS max FROM lesson_blocks WHERE lesson_id = ${lessonId}`;
  const nextSort = ((maxSortRows as { max: number }[])[0]?.max ?? 0) + 10;

  // New blocks default to the nearest preceding section_heading's access tier — nudges authors
  // toward gating at "meaningful section boundaries" (per the founder's spec) without a hard DB
  // constraint; still overridable per-block via PATCH.
  const precedingSectionRows = await sql`
    SELECT block_access FROM lesson_blocks
    WHERE lesson_id = ${lessonId} AND block_type = 'section_heading' AND sort_order < ${nextSort}
    ORDER BY sort_order DESC LIMIT 1
  `;
  const inheritedAccess = (precedingSectionRows as { block_access: string }[])[0]?.block_access ?? "public";

  const rows = await sql`
    INSERT INTO lesson_blocks (lesson_id, block_type, block_data, sort_order, status, block_access)
    VALUES (${lessonId}, ${blockType}, ${JSON.stringify(blockData)}::jsonb, ${nextSort}, 'draft', ${inheritedAccess})
    RETURNING id, lesson_id, block_type, block_data, sort_order, status, block_access
  `;
  return NextResponse.json((rows as unknown[])[0]);
}
