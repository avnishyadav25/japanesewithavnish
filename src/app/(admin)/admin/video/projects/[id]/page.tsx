import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getProject, listJobs, listRenders, listStoryboards } from "@/lib/video/projects";
import { ProjectWorkspace } from "./ProjectWorkspace";

export const dynamic = "force-dynamic";

export default async function VideoProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!sql) {
    return (
      <div>
        <AdminPageHeader title="Video project" breadcrumb={[{ label: "Admin", href: "/admin" }]} />
        <AdminCard>Database unavailable.</AdminCard>
      </div>
    );
  }

  const project = await getProject(id);
  if (!project) notFound();

  const [storyboards, jobs, renders, themeRow] = await Promise.all([
    listStoryboards(id),
    listJobs({ projectId: id, limit: 25 }),
    listRenders({ projectId: id, limit: 25 }),
    sql`SELECT tokens FROM video_themes WHERE key = ${project.themeKey}` as Promise<{ tokens: Record<string, unknown> }[]>,
  ]);

  return (
    <div>
      <AdminPageHeader
        title={project.title}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Video Studio", href: "/admin/video" },
          { label: "Projects", href: "/admin/video/projects" },
          { label: project.title },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3 mb-6 text-sm text-secondary">
        <StatusBadge status={project.status} />
        <span>{project.scopeKind.replace(/_/g, " ")}</span>
        <span>·</span>
        <span>{project.formats.join(", ")}</span>
        <span>·</span>
        <span>{project.narrationLangs.join(", ")}</span>
        <span>·</span>
        <span>{project.themeKey}</span>
      </div>

      {project.errorMessage && (
        <AdminCard className="mb-6 border-l-4 border-red-400">
          <p className="text-sm font-semibold text-charcoal mb-1">Last error</p>
          <p className="text-sm text-secondary break-words">{project.errorMessage}</p>
        </AdminCard>
      )}

      <ProjectWorkspace
        project={project}
        storyboards={storyboards}
        initialJobs={jobs}
        initialRenders={renders}
        themeTokens={(themeRow[0]?.tokens as Record<string, unknown>) ?? null}
      />
    </div>
  );
}
