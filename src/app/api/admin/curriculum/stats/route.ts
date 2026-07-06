import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const levels = (await sql`
    SELECT lv.code AS level_code,
      COUNT(DISTINCT m.id) AS modules,
      COUNT(DISTINCT sm.id) AS submodules,
      COUNT(DISTINCT l.id) AS lessons,
      COUNT(DISTINCT CASE WHEN l.description IS NOT NULL AND l.description != '' THEN l.id END) AS lessons_with_description,
      COUNT(DISTINCT p.id) AS total_practices,
      COUNT(DISTINCT CASE WHEN l.access_type = 'free' THEN l.id END) AS free_lessons,
      COUNT(DISTINCT CASE WHEN l.access_type = 'premium' THEN l.id END) AS premium_lessons
    FROM curriculum_levels lv
    LEFT JOIN curriculum_modules m ON m.level_id = lv.id
    LEFT JOIN curriculum_submodules sm ON sm.module_id = m.id
    LEFT JOIN curriculum_lessons l ON l.submodule_id = sm.id
    LEFT JOIN curriculum_practices p ON p.lesson_id = l.id
    GROUP BY lv.code, lv.sort_order
    ORDER BY lv.sort_order
  `) as {
    level_code: string;
    modules: string;
    submodules: string;
    lessons: string;
    lessons_with_description: string;
    total_practices: string;
    free_lessons: string;
    premium_lessons: string;
  }[];

  return NextResponse.json(
    levels.map((r) => ({
      level: r.level_code,
      modules: Number(r.modules),
      submodules: Number(r.submodules),
      lessons: Number(r.lessons),
      lessonsWithDescription: Number(r.lessons_with_description),
      totalPractices: Number(r.total_practices),
      freeLessons: Number(r.free_lessons),
      premiumLessons: Number(r.premium_lessons),
      descriptionCoverage: Number(r.lessons) > 0
        ? Math.round((Number(r.lessons_with_description) / Number(r.lessons)) * 100)
        : 0,
    }))
  );
}
