import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SubmoduleEditFormClient } from "./SubmoduleEditFormClient";

export default async function AdminCurriculumSubmodulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!sql) notFound();
  const rows = await sql`
    SELECT s.id, s.code, s.title, s.sort_order, s.summary, s.description, s.feature_image_url, lv.code AS level_code, m.title AS module_title
    FROM curriculum_submodules s
    JOIN curriculum_modules m ON m.id = s.module_id
    JOIN curriculum_levels lv ON lv.id = m.level_id
    WHERE s.id = ${id} LIMIT 1
  `;
  const row = (rows as { id: string; code: string; title: string; sort_order: number; summary: string | null; description: string | null; feature_image_url: string | null; level_code: string; module_title: string }[])[0];
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
          { label: row.module_title },
          { label: `${row.code} — ${row.title}` },
        ]}
        action={{ label: "← Curriculum", href: "/admin/learn/curriculum" }}
      />
      <SubmoduleEditFormClient
        submoduleId={row.id}
        levelCode={row.level_code}
        moduleTitle={row.module_title}
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
