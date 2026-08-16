import Link from "next/link";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { FilterPills } from "@/components/admin/FilterPills";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { DeleteProjectButton } from "./DeleteProjectButton";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  title: string;
  status: string;
  scope_kind: string;
  formats: string[];
  narration_langs: string[];
  created_by: string | null;
  created_at: string;
  render_count: number;
};

export default async function VideoProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  let projects: Row[] = [];

  if (sql) {
    projects = (await sql.query(
      `SELECT p.id, p.title, p.status, p.scope_kind, p.formats, p.narration_langs, p.created_by,
              p.created_at::text AS created_at,
              (SELECT COUNT(*)::int FROM video_renders r WHERE r.project_id = p.id AND r.is_current) AS render_count
       FROM video_projects p
       ${status ? "WHERE p.status = $1" : ""}
       ORDER BY p.created_at DESC
       LIMIT 200`,
      status ? [status] : []
    )) as Row[];
  }

  // draft / render_ready / queued_render / rejected were missing, so a finished project was
  // only reachable through "All" — and the content plan's status chips link here by status,
  // which meant clicking "render_ready 3" landed on a filter with no matching pill.
  const filters = [
    { label: "All", value: undefined },
    { label: "Draft", value: "draft" },
    { label: "Needs script review", value: "script_pending_review" },
    { label: "Ready to render", value: "script_ready" },
    { label: "Queued", value: "queued_render" },
    { label: "Rendering", value: "rendering" },
    { label: "Needs video review", value: "video_pending_review" },
    { label: "Done", value: "render_ready" },
    { label: "Failed", value: "failed" },
    { label: "Rejected", value: "rejected" },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Video projects"
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Video Studio", href: "/admin/video" },
          { label: "Projects" },
        ]}
        action={{ label: "New video", href: "/admin/video/new" }}
      />

      <div className="mb-5">
        <FilterPills options={filters} active={status} basePath="/admin/video/projects" />
      </div>

      {projects.length === 0 ? (
        <AdminEmptyState
          message={status ? "No projects with that status." : "No video projects yet."}
          action={{ label: "New video", href: "/admin/video/new" }}
        />
      ) : (
        <AdminCard>
          <AdminTable headers={["Title", "Scope", "Formats", "Languages", "Videos", "Status", "Created", ""]}>
            {projects.map((project) => (
              <tr key={project.id} className="border-b border-[var(--divider)] last:border-0">
                <td className="py-3 px-2">
                  <Link href={`/admin/video/projects/${project.id}`} className="text-primary hover:underline font-medium">
                    {project.title}
                  </Link>
                  {project.created_by && <div className="text-xs text-secondary">{project.created_by}</div>}
                </td>
                <td className="py-3 px-2 text-secondary">{project.scope_kind.replace(/_/g, " ")}</td>
                <td className="py-3 px-2 text-secondary">{(project.formats ?? []).join(", ")}</td>
                <td className="py-3 px-2 text-secondary">{(project.narration_langs ?? []).join(", ")}</td>
                <td className="py-3 px-2 text-secondary">{project.render_count}</td>
                <td className="py-3 px-2">
                  <StatusBadge status={project.status} />
                </td>
                <td className="py-3 px-2 text-secondary whitespace-nowrap">
                  {new Date(project.created_at).toLocaleDateString()}
                </td>
                <td className="py-3 px-2 text-right">
                  <DeleteProjectButton
                    projectId={project.id}
                    title={project.title}
                    renderCount={project.render_count}
                  />
                </td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      )}
    </div>
  );
}
