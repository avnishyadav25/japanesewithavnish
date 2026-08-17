import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { BgmLibrary, type BgmTrack } from "./BgmLibrary";
import { ThemeEditor, type ThemeRow } from "./ThemeEditor";
import { BrollLibrary } from "./BrollLibrary";

export const dynamic = "force-dynamic";

export default async function VideoAssetsPage() {
  let tracks: BgmTrack[] = [];
  let themes: ThemeRow[] = [];
  let brollEnabled = false;

  if (sql) {
    // Themes carry their project usage count: disabling a theme a project references breaks that
    // project's row, since theme_key is a FK with ON UPDATE CASCADE and no ON DELETE.
    const [trackRows, themeRows, brollProjects] = await Promise.all([
      sql`SELECT id, title, audio_url, duration_seconds, mood, license, attribution, source_url,
                 default_gain_db, is_enabled, created_at::text AS created_at
          FROM video_bgm_tracks ORDER BY created_at DESC` as Promise<BgmTrack[]>,
      sql`SELECT t.key, t.label, t.description, t.tokens, t.default_voices, t.is_enabled,
                 (SELECT COUNT(*)::int FROM video_projects p WHERE p.theme_key = t.key) AS usage_count
          FROM video_themes t ORDER BY t.sort_order, t.label` as Promise<Record<string, unknown>[]>,
      sql`SELECT COUNT(*)::int AS n FROM video_projects WHERE include_broll` as Promise<{ n: number }[]>,
    ]);

    tracks = trackRows;
    brollEnabled = (brollProjects[0]?.n ?? 0) > 0;
    themes = themeRows.map((r) => ({
      key: String(r.key),
      label: String(r.label),
      description: (r.description as string | null) ?? null,
      tokens: (r.tokens as Record<string, unknown>) ?? {},
      defaultVoices: (r.default_voices as Record<string, unknown>) ?? {},
      isEnabled: Boolean(r.is_enabled),
      usageCount: Number(r.usage_count),
    }));
  }

  return (
    <div>
      <AdminPageHeader
        title="Video assets"
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Video Studio", href: "/admin/video" },
          { label: "Assets" },
        ]}
      />

      <section className="mb-10">
        <h2 className="font-heading text-lg font-bold text-charcoal mb-1">Background music</h2>
        <p className="text-sm text-secondary mb-4">
          Music ducks automatically under the narration, frame by frame, using the same caption
          timings the video is cut to. Record where each track came from — a copyright claim
          applies retroactively to every video that used it.
        </p>
        <BgmLibrary initialTracks={tracks} />
      </section>

      <section className="mb-10">
        <h2 className="font-heading text-lg font-bold text-charcoal mb-1">Themes</h2>
        <p className="text-sm text-secondary mb-4">
          Colours, fonts and default voices for the scene templates. Duplicate one before
          experimenting — every project defaults to these.
        </p>
        <ThemeEditor initial={themes} />
      </section>

      <section>
        <h2 className="font-heading text-lg font-bold text-charcoal mb-1">B-roll cache</h2>
        <BrollLibrary brollEnabled={brollEnabled} />
      </section>
    </div>
  );
}
