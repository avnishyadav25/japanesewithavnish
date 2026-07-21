import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

/** Marks one section (identified by the section_heading block that starts it) complete for the
 * current user. Mirrors the auth/insert pattern of POST /api/learn/progress (LessonCompleteButton)
 * — no GET counterpart: the owning page already queries user_section_progress directly (same
 * request that fetches the lesson's blocks), and the client re-syncs via router.refresh() after
 * a successful POST, same as the existing lesson-level complete button. */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await req.json();
  const ownerType = body.ownerType === "post" ? "post" : "lesson";
  const ownerId = typeof body.ownerId === "string" ? body.ownerId : null;
  const sectionBlockId = typeof body.sectionBlockId === "string" ? body.sectionBlockId : null;
  const method = body.method === "checkpoint_passed" ? "checkpoint_passed" : "manual";

  if (!ownerId || !sectionBlockId) {
    return NextResponse.json({ error: "ownerId and sectionBlockId required" }, { status: 400 });
  }

  await sql`
    INSERT INTO user_section_progress (user_email, owner_type, owner_id, section_block_id, method)
    VALUES (${session.email}, ${ownerType}, ${ownerId}, ${sectionBlockId}, ${method})
    ON CONFLICT (user_email, owner_type, owner_id, section_block_id) DO NOTHING
  `;

  return NextResponse.json({ success: true });
}
