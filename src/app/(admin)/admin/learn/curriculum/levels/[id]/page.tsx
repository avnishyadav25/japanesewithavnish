import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { LevelEditFormClient } from "./LevelEditFormClient";

export default async function AdminCurriculumLevelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!sql) notFound();
  const rows = await sql`
    SELECT id, code, name, sort_order, summary, description, feature_image_url FROM curriculum_levels WHERE id = ${id} LIMIT 1
  `;
  const row = (rows as { id: string; code: string; name: string; sort_order: number; summary: string | null; description: string | null; feature_image_url: string | null }[])[0];
  if (!row) notFound();

  return (
    <div>
      <AdminPageHeader
        title={row.name}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Learning Content" },
          { label: "Curriculum", href: "/admin/learn/curriculum" },
          { label: "Levels" },
          { label: `${row.code} — ${row.name}` },
        ]}
        action={{ label: "← Curriculum", href: "/admin/learn/curriculum" }}
      />
      <LevelEditFormClient
        levelId={row.id}
        initial={{
          code: row.code,
          name: row.name,
          sort_order: row.sort_order,
          summary: row.summary ?? "",
          description: row.description ?? "",
          feature_image_url: row.feature_image_url ?? "",
        }}
      />
    </div>
  );
}
