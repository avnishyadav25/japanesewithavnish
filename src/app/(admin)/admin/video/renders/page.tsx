import Link from "next/link";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  project_id: string;
  project_title: string;
  format: string;
  narration_lang: string;
  video_url: string;
  poster_url: string | null;
  srt_url: string | null;
  duration_seconds: string | null;
  width: number | null;
  height: number | null;
  file_size_bytes: string | null;
  approval_status: string;
  is_current: boolean;
  created_at: string;
};

export default async function VideoRendersPage() {
  let renders: Row[] = [];
  if (sql) {
    renders = (await sql`
      SELECT r.id, r.project_id, p.title AS project_title, r.format, r.narration_lang, r.video_url,
             r.poster_url, r.srt_url, r.duration_seconds, r.width, r.height, r.file_size_bytes,
             r.approval_status, r.is_current, r.created_at::text AS created_at
      FROM video_renders r
      JOIN video_projects p ON p.id = r.project_id
      ORDER BY r.created_at DESC
      LIMIT 60
    `) as Row[];
  }

  return (
    <div>
      <AdminPageHeader
        title="Finished videos"
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Video Studio", href: "/admin/video" },
          { label: "Videos" },
        ]}
      />

      {renders.length === 0 ? (
        <AdminEmptyState message="No videos rendered yet." action={{ label: "New video", href: "/admin/video/new" }} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {renders.map((render) => (
            <AdminCard key={render.id} className="!p-0 overflow-hidden">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption -- captions ship as a
                  separate .srt and are also burned into the frame */}
              <video
                src={render.video_url}
                poster={render.poster_url ?? undefined}
                controls
                preload="none"
                className="w-full bg-black"
              />
              <div className="p-4 space-y-1.5">
                <Link
                  href={`/admin/video/projects/${render.project_id}`}
                  className="text-primary hover:underline font-medium text-sm block"
                >
                  {render.project_title}
                </Link>
                <div className="flex items-center gap-2 flex-wrap text-xs text-secondary">
                  <span>{render.format}</span>
                  <span>·</span>
                  <span>{render.narration_lang}</span>
                  <span>·</span>
                  <span>
                    {render.width}×{render.height}
                  </span>
                  <span>·</span>
                  <span>{render.duration_seconds ? `${Number(render.duration_seconds).toFixed(1)}s` : "—"}</span>
                  <span>·</span>
                  <span>
                    {render.file_size_bytes ? `${(Number(render.file_size_bytes) / 1_000_000).toFixed(1)} MB` : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  {!render.is_current && <StatusBadge status="superseded" />}
                  {render.approval_status === "pending_review" && <StatusBadge status="pending_review" />}
                  <a href={render.video_url} download className="text-xs text-primary hover:underline">
                    Download
                  </a>
                  {render.srt_url && (
                    <a href={render.srt_url} download className="text-xs text-primary hover:underline">
                      Captions
                    </a>
                  )}
                </div>
              </div>
            </AdminCard>
          ))}
        </div>
      )}
    </div>
  );
}
