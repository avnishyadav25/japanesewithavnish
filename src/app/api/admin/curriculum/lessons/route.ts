import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { getLessonTemplateBlocks } from "@/lib/curriculum/lessonTemplates";

const VALID_ACCESS = ["free", "premium"];
const VALID_CONTENT_TYPES = ["grammar", "vocabulary", "kanji", "kana", "reading", "listening", "writing", "conversation", "review", "mock_test", "mixed"];

export async function GET(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const submoduleId = req.nextUrl.searchParams.get("submoduleId");
  if (!submoduleId) return NextResponse.json({ error: "submoduleId required" }, { status: 400 });
  try {
    const rows = await sql`
      SELECT id, submodule_id, code, title, goal, introduction,
             description, access_type, content_type, estimated_minutes,
             sort_order, feature_image_url, created_at, updated_at
      FROM curriculum_lessons
      WHERE submodule_id = ${submoduleId}
      ORDER BY sort_order, code
    `;
    return NextResponse.json(rows);
  } catch (e) {
    console.error("Curriculum lessons GET:", e);
    return NextResponse.json({ error: "Failed to list lessons" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  try {
    const body = await req.json();
    const {
      submodule_id, code, title, goal, introduction,
      description, access_type, content_type, estimated_minutes, sort_order,
    } = body;
    if (!submodule_id || typeof submodule_id !== "string" || !code || typeof code !== "string" || !title || typeof title !== "string") {
      return NextResponse.json({ error: "submodule_id, code, title required" }, { status: 400 });
    }
    const accessVal = VALID_ACCESS.includes(access_type) ? access_type : "premium";
    const contentTypeVal = VALID_CONTENT_TYPES.includes(content_type) ? content_type : null;
    const sort = typeof sort_order === "number" ? sort_order : 0;
    const rows = await sql`
      INSERT INTO curriculum_lessons
        (submodule_id, code, title, goal, introduction, description, access_type, content_type, estimated_minutes, sort_order)
      VALUES (
        ${submodule_id}, ${code.trim()}, ${title.trim()},
        ${goal?.trim() || null}, ${introduction?.trim() || null},
        ${description?.trim() || null}, ${accessVal}, ${contentTypeVal},
        ${estimated_minutes ?? null}, ${sort}
      )
      RETURNING id, submodule_id, code, title, goal, introduction,
                description, access_type, content_type, estimated_minutes,
                sort_order, feature_image_url, created_at, updated_at
    `;
    const lesson = (rows as { id: string }[])[0];

    // Scaffold-on-create: give the admin a starter block set matching the lesson's content type.
    const templateBlocks = getLessonTemplateBlocks(contentTypeVal);
    let sort2 = 10;
    for (const b of templateBlocks) {
      await sql`
        INSERT INTO lesson_blocks (lesson_id, block_type, block_data, sort_order, status)
        VALUES (${lesson.id}, ${b.block_type}, ${JSON.stringify(b.block_data)}::jsonb, ${sort2}, 'draft')
      `;
      sort2 += 10;
    }

    return NextResponse.json(lesson);
  } catch (e: unknown) {
    const msg = e && typeof e === "object" && "code" in e && (e as { code: string }).code === "23505"
      ? "Lesson code already exists for this submodule"
      : "Failed to create lesson";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
