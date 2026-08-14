import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const rows = await sql`
      SELECT b.id, b.lesson_id, b.block_type, b.block_data, b.sort_order, b.generated_by_model, b.created_at,
             l.title AS lesson_title, l.code AS lesson_code
      FROM lesson_blocks b
      JOIN curriculum_lessons l ON l.id = b.lesson_id
      WHERE b.review_status = 'pending'
      ORDER BY l.title, b.sort_order
    `;
    return NextResponse.json(rows);
  } catch (e) {
    console.error("Admin review-queue GET:", e);
    return NextResponse.json({ error: "Failed to load review queue" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  try {
    const body = await req.json();
    const { id, action } = body as { id?: string; action?: "approve" | "reject" };
    if (!id || (action !== "approve" && action !== "reject")) {
      return NextResponse.json({ error: "id and action ('approve'|'reject') required" }, { status: 400 });
    }

    const rows = action === "approve"
      ? await sql`
          UPDATE lesson_blocks SET
            status = 'published',
            review_status = 'approved',
            reviewed_by = ${admin.email},
            reviewed_at = NOW(),
            updated_at = NOW()
          WHERE id = ${id}
          RETURNING id
        `
      : await sql`
          UPDATE lesson_blocks SET
            review_status = 'rejected',
            reviewed_by = ${admin.email},
            reviewed_at = NOW(),
            updated_at = NOW()
          WHERE id = ${id}
          RETURNING id
        `;
    if (!(rows as unknown[])?.length) return NextResponse.json({ error: "Block not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Admin review-queue PATCH:", e);
    return NextResponse.json({ error: "Failed to update block" }, { status: 500 });
  }
}
