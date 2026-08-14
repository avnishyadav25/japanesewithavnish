import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

const JOIN_TABLES: Record<string, { table: string; column: string }> = {
  vocabulary: { table: "curriculum_lesson_vocabulary", column: "vocabulary_id" },
  grammar: { table: "curriculum_lesson_grammar", column: "grammar_id" },
  kanji: { table: "curriculum_lesson_kanji", column: "kanji_id" },
  kana: { table: "curriculum_lesson_kana", column: "kana_id" },
};

type UsageLesson = { lesson_id: string; lesson_title: string; lesson_code: string; module_title: string; level_code: string };

export async function GET(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const type = req.nextUrl.searchParams.get("type");
  const idsParam = req.nextUrl.searchParams.get("ids");
  const joinDef = type ? JOIN_TABLES[type] : undefined;
  if (!joinDef) return NextResponse.json({ error: "type must be one of vocabulary|grammar|kanji|kana" }, { status: 400 });
  if (!idsParam) return NextResponse.json({ error: "ids required (comma-separated)" }, { status: 400 });

  const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return NextResponse.json({});

  // Table/column names come from a fixed internal map, not user input — safe to interpolate.
  const rows = (await sql.query(
    `SELECT j."${joinDef.column}" AS item_id, l.id AS lesson_id, l.title AS lesson_title, l.code AS lesson_code,
            m.title AS module_title, lv.code AS level_code
     FROM ${joinDef.table} j
     JOIN curriculum_lessons l ON l.id = j.lesson_id
     JOIN curriculum_submodules sm ON sm.id = l.submodule_id
     JOIN curriculum_modules m ON m.id = sm.module_id
     JOIN curriculum_levels lv ON lv.id = m.level_id
     WHERE j."${joinDef.column}" = ANY($1::uuid[])
     ORDER BY lv.sort_order, m.sort_order, l.sort_order`,
    [ids]
  )) as unknown as (UsageLesson & { item_id: string })[];

  const byItem: Record<string, UsageLesson[]> = {};
  for (const r of rows) {
    if (!byItem[r.item_id]) byItem[r.item_id] = [];
    byItem[r.item_id].push({
      lesson_id: r.lesson_id,
      lesson_title: r.lesson_title,
      lesson_code: r.lesson_code,
      module_title: r.module_title,
      level_code: r.level_code,
    });
  }
  return NextResponse.json(byItem);
}
