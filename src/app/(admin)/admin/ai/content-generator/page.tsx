import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { ContentGeneratorClient } from "./ContentGeneratorClient";

type LessonOption = {
  id: string;
  title: string;
  level_code: string;
  module_title: string;
};

export default async function AdminAIContentGeneratorPage() {
  let lessons: LessonOption[] = [];
  if (sql) {
    try {
      lessons = (await sql`
        SELECT l.id, l.title, lv.code AS level_code, m.title AS module_title
        FROM curriculum_lessons l
        JOIN curriculum_submodules sm ON sm.id = l.submodule_id
        JOIN curriculum_modules m ON m.id = sm.module_id
        JOIN curriculum_levels lv ON lv.id = m.level_id
        ORDER BY lv.sort_order, m.sort_order, sm.sort_order, l.sort_order
        LIMIT 500
      `) as LessonOption[];
    } catch (error) {
      console.error("Admin content generator lessons:", error);
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="AI Content Generator"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "AI Tools" }, { label: "Content Generator" }]}
      />
      {lessons.length ? <ContentGeneratorClient lessons={lessons} /> : <AdminEmptyState message="No curriculum lessons found." />}
    </div>
  );
}
