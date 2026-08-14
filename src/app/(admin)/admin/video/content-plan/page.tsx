import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { MaybeSocialIcon } from "@/components/icons/SocialIcons";
import {
  JLPT_LEVELS,
  VIDEO_CONTENT_TYPES,
  getCadenceLoad,
  getPipelineCounts,
  getUnpostedRenders,
  getVideoCoverageMatrix,
} from "@/lib/social/contentPlan";
import { NextUpButton } from "./NextUpButton";

export const dynamic = "force-dynamic";

/**
 * What to make next, and what is stuck.
 *
 * Built on real counts rather than an LLM's imagination — the model's only job on this page is
 * to read these numbers back as suggestions. The definitions are printed next to the numbers
 * because a month of work gets scheduled off them.
 */
export default async function ContentPlanPage() {
  const [matrix, unposted, pipeline, cadence] = await Promise.all([
    getVideoCoverageMatrix(),
    getUnpostedRenders(20),
    getPipelineCounts(),
    getCadenceLoad(),
  ]);

  const byKey = new Map(matrix.map((c) => [`${c.level}:${c.contentType}`, c]));
  const totalPublished = matrix.reduce((n, c) => n + c.total, 0);
  const totalCovered = matrix.reduce((n, c) => n + c.withVideo, 0);

  return (
    <div>
      <AdminPageHeader
        title="Content plan"
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Video Studio", href: "/admin/video" },
          { label: "Content plan" },
        ]}
        actions={[{ label: "New video", href: "/admin/video/new" }]}
      />

      {/* -------- Pipeline -------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <Tile label="Published items" value={totalPublished.toLocaleString()} />
        <Tile label="With a video" value={totalCovered.toLocaleString()} />
        <Tile label="Rendered" value={String(pipeline.rendersCurrent)} />
        <Tile label="Posted" value={String(pipeline.rendersPosted)} />
        <Tile
          label="Not posted"
          value={String(pipeline.rendersUnposted)}
          tone={pipeline.rendersUnposted > 0 ? "warn" : undefined}
        />
        <Tile label="Awaiting manual" value={String(pipeline.postsAwaitingManual)} />
      </div>

      {pipeline.projectsByStatus.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          {pipeline.projectsByStatus.map((s) => (
            <Link
              key={s.status}
              href={`/admin/video/projects?status=${s.status}`}
              className="px-3 py-1.5 rounded-bento text-sm bg-base border border-[var(--divider)] text-secondary hover:border-primary hover:text-primary transition inline-flex items-center gap-2"
            >
              <StatusBadge status={s.status} />
              <span>{s.count}</span>
            </Link>
          ))}
        </div>
      )}

      {/* -------- What to make next -------- */}
      <div className="flex items-center justify-between gap-4 mb-3">
        <h2 className="font-heading text-lg font-bold text-charcoal">Coverage</h2>
        <NextUpButton />
      </div>
      <AdminCard className="mb-8">
        <p className="text-xs text-secondary mb-4">
          A published item counts as <strong>having a video</strong> when it appears in the content snapshot of a
          storyboard whose project has a current, non-rejected render. A batch that made one video from ten words
          marks all ten — so this reads &ldquo;appeared in a video&rdquo;, not &ldquo;has its own video&rdquo;.
        </p>
        <div className="overflow-x-auto">
          <AdminTable headers={["Level", ...VIDEO_CONTENT_TYPES.map((t) => t.replace(/_/g, " "))]}>
            {JLPT_LEVELS.map((level) => (
              <tr key={level}>
                <td className="py-3 px-2 font-semibold text-charcoal">{level}</td>
                {VIDEO_CONTENT_TYPES.map((type) => {
                  const cell = byKey.get(`${level}:${type}`);
                  if (!cell || cell.total === 0) {
                    return (
                      <td key={type} className="py-3 px-2 text-secondary opacity-40">
                        —
                      </td>
                    );
                  }
                  const gap = cell.withVideo === 0;
                  return (
                    <td key={type} className="py-3 px-2 whitespace-nowrap">
                      <Link
                        href={`/admin/video/new?contentType=${type}&jlptLevel=${level}`}
                        className={gap ? "text-primary hover:underline" : "text-charcoal hover:underline"}
                        title={`${cell.withVideo} of ${cell.total} ${type} items at ${level} have appeared in a video`}
                      >
                        <span className="tabular-nums">
                          {cell.withVideo}/{cell.total}
                        </span>
                        {gap && <span className="ml-1 text-xs">gap</span>}
                      </Link>
                    </td>
                  );
                })}
              </tr>
            ))}
          </AdminTable>
        </div>
      </AdminCard>

      {/* -------- The gap that had no UI at all -------- */}
      <h2 className="font-heading text-lg font-bold text-charcoal mb-3">Rendered but never posted</h2>
      <AdminCard className="mb-8">
        {unposted.length === 0 ? (
          <p className="text-sm text-secondary">
            Everything rendered has been posted somewhere. {pipeline.rendersCurrent === 0 && "Then again, nothing is rendered yet."}
          </p>
        ) : (
          <>
            <p className="text-xs text-secondary mb-4">
              An on-site embed is not counted as posted — it is a different channel, and counting it would hide
              exactly this gap.
            </p>
            <AdminTable headers={["Video", "Format", "Length", "On site", "Rendered", ""]}>
              {unposted.map((r) => (
                <tr key={r.renderId}>
                  <td className="py-3 px-2">
                    <Link href={`/admin/video/projects/${r.projectId}`} className="text-charcoal hover:underline">
                      {r.title}
                    </Link>
                  </td>
                  <td className="py-3 px-2 text-secondary">{r.format}</td>
                  <td className="py-3 px-2 text-secondary tabular-nums">
                    {r.durationSeconds ? `${Math.round(r.durationSeconds)}s` : "—"}
                  </td>
                  <td className="py-3 px-2 text-secondary tabular-nums">{r.siteLinks > 0 ? r.siteLinks : "—"}</td>
                  <td className="py-3 px-2 text-secondary whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-2">
                    <Link href={`/admin/social/briefs/new?renderId=${r.renderId}`} className="text-primary hover:underline">
                      Promote
                    </Link>
                  </td>
                </tr>
              ))}
            </AdminTable>
          </>
        )}
      </AdminCard>

      {/* -------- Cadence -------- */}
      <h2 className="font-heading text-lg font-bold text-charcoal mb-3">Posting rate</h2>
      <AdminCard>
        <p className="text-xs text-secondary mb-4">
          Last 7 days against the target cadence in the 30-day plan. Pure-CSS bars; the target is the full width.
        </p>
        <div className="space-y-2.5">
          {cadence.map((c) => {
            const pct = c.budgetPerWeek > 0 ? Math.min(100, (c.posted7d / c.budgetPerWeek) * 100) : 0;
            return (
              <div key={c.platform} className="flex items-center gap-3">
                <div className="w-28 flex items-center gap-2 text-sm text-charcoal shrink-0">
                  <MaybeSocialIcon platform={c.platform} className="w-3.5 h-3.5" />
                  {c.platform}
                </div>
                <div className="flex-1 h-2 bg-base rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <div className="w-24 text-right text-xs text-secondary tabular-nums shrink-0">
                  {c.posted7d} / {c.budgetPerWeek}
                </div>
              </div>
            );
          })}
        </div>
      </AdminCard>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <AdminCard>
      <p className="text-secondary text-xs uppercase tracking-wider">{label}</p>
      <p className={`font-heading text-2xl font-bold ${tone === "warn" ? "text-amber-600" : "text-charcoal"}`}>
        {value}
      </p>
    </AdminCard>
  );
}
