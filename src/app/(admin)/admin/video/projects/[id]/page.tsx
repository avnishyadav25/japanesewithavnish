import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { getProject, listJobs, listRenders, listStoryboards } from "@/lib/video/projects";
import { publicationSummaryForRender } from "@/lib/social/publications";
import { ProjectWorkspace } from "./ProjectWorkspace";
import { DeleteProjectButton } from "../DeleteProjectButton";

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

  const [storyboards, jobs, renders, themeRow, bgmRow] = await Promise.all([
    listStoryboards(id),
    listJobs({ projectId: id, limit: 25 }),
    listRenders({ projectId: id, limit: 25 }),
    sql`SELECT tokens FROM video_themes WHERE key = ${project.themeKey}` as Promise<{ tokens: Record<string, unknown> }[]>,
    project.bgmTrackId
      ? (sql`SELECT audio_url, title FROM video_bgm_tracks WHERE id = ${project.bgmTrackId}::uuid` as Promise<
          { audio_url: string; title: string }[]
        >)
      : Promise.resolve([] as { audio_url: string; title: string }[]),
  ]);

  // Distribution state for the current renders only — the ones whose cards show a status line.
  // Loaded here rather than inside listRenders() so the 60-row /admin/video/renders grid does
  // not pay for lookups it never displays.
  const current = renders.filter((r) => r.isCurrent);
  const publications = await Promise.all(current.map((r) => publicationSummaryForRender(r.id)));
  const publicationsByRender = new Map(current.map((r, i) => [r.id, publications[i]]));
  const rendersWithPublications = renders.map((r) => ({
    ...r,
    publications: publicationsByRender.get(r.id),
  }));

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
        <span className="ml-auto">
          <DeleteProjectButton
            projectId={project.id}
            title={project.title}
            renderCount={renders.filter((r) => r.isCurrent).length}
            redirectTo="/admin/video/projects"
          />
        </span>
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
        initialRenders={rendersWithPublications}
        themeTokens={(themeRow[0]?.tokens as Record<string, unknown>) ?? null}
        bgmUrl={bgmRow[0]?.audio_url ?? null}
        bgmTitle={bgmRow[0]?.title ?? null}
      />
    </div>
  );
}
