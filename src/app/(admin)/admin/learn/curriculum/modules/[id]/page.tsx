import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ModuleEditFormClient } from "./ModuleEditFormClient";

export default async function AdminCurriculumModulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!sql) notFound();
  const rows = await sql`
    SELECT m.id, m.code, m.title, m.sort_order, m.summary, m.description, m.feature_image_url, lv.code AS level_code
    FROM curriculum_modules m
    JOIN curriculum_levels lv ON lv.id = m.level_id
    WHERE m.id = ${id} LIMIT 1
  `;
  const row = (rows as { id: string; code: string; title: string; sort_order: number; summary: string | null; description: string | null; feature_image_url: string | null; level_code: string }[])[0];
  if (!row) notFound();

  return (
    <div>
      <AdminPageHeader
        title={row.title}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Learning Content" },
          { label: "Curriculum", href: "/admin/learn/curriculum" },
          { label: `${row.level_code}` },
          { label: `${row.code} — ${row.title}` },
        ]}
        action={{ label: "← Curriculum", href: "/admin/learn/curriculum" }}
      />
      <ModuleEditFormClient
        moduleId={row.id}
        levelCode={row.level_code}
        initial={{
          code: row.code,
          title: row.title,
          sort_order: row.sort_order,
          summary: row.summary ?? "",
          description: row.description ?? "",
          feature_image_url: row.feature_image_url ?? "",
        }}
      />
    </div>
  );
}
