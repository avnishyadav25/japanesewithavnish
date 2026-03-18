import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { LessonEditForm } from "./LessonEditForm";
import { LessonLinksSection } from "./LessonLinksSection";

export default async function AdminCurriculumLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!sql) notFound();
  const rows = await sql`
    SELECT l.id, l.submodule_id, l.code, l.title, l.goal, l.introduction, l.sort_order, l.feature_image_url,
           sm.title AS submodule_title, m.title AS module_title, m.level_id, lv.code AS level_code
    FROM curriculum_lessons l
    JOIN curriculum_submodules sm ON sm.id = l.submodule_id
    JOIN curriculum_modules m ON m.id = sm.module_id
    JOIN curriculum_levels lv ON lv.id = m.level_id
    WHERE l.id = ${id} LIMIT 1
  `;
  const row = (rows as { id: string; submodule_id: string; code: string; title: string; goal: string | null; introduction: string | null; sort_order: number; feature_image_url: string | null; submodule_title: string; module_title: string; level_id: string; level_code: string }[])[0];
  if (!row) notFound();

  return (
    <div>
      <AdminPageHeader
        title={row.title}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Learning Content" },
          { label: "Curriculum", href: "/admin/learn/curriculum" },
          { label: `${row.level_code} › ${row.module_title} › ${row.submodule_title}` },
          { label: row.title },
        ]}
      />
      <LessonEditForm
        lessonId={row.id}
        levelCode={row.level_code}
        initial={{ code: row.code, title: row.title, goal: row.goal ?? "", introduction: row.introduction ?? "", sort_order: row.sort_order, feature_image_url: row.feature_image_url ?? "" }}
      />
      <LessonLinksSection lessonId={row.id} lessonTitle={row.title} levelCode={row.level_code} />
    </div>
  );
}
