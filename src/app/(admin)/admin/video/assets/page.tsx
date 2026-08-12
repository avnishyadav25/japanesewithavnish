import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { BgmLibrary, type BgmTrack } from "./BgmLibrary";

export const dynamic = "force-dynamic";

type BrollRow = {
  id: string;
  source_url: string;
  capture_kind: string;
  viewport_w: number;
  viewport_h: number;
  asset_url: string;
  captured_at: string;
  expires_at: string;
};

export default async function VideoAssetsPage() {
  let tracks: BgmTrack[] = [];
  let broll: BrollRow[] = [];
  let themes: { key: string; label: string; description: string | null; sort_order: number }[] = [];

  if (sql) {
    [tracks, broll, themes] = await Promise.all([
      sql`SELECT id, title, audio_url, duration_seconds, mood, license, attribution, source_url,
                 default_gain_db, is_enabled, created_at::text AS created_at
          FROM video_bgm_tracks ORDER BY created_at DESC` as Promise<BgmTrack[]>,
      sql`SELECT id, source_url, capture_kind, viewport_w, viewport_h, asset_url,
                 captured_at::text AS captured_at, expires_at::text AS expires_at
          FROM video_broll_assets ORDER BY captured_at DESC LIMIT 40` as Promise<BrollRow[]>,
      sql`SELECT key, label, description, sort_order FROM video_themes
          WHERE is_enabled ORDER BY sort_order` as Promise<
        { key: string; label: string; description: string | null; sort_order: number }[]
      >,
    ]);
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
          Colours and fonts for the scene templates. Edit these in the <code className="bg-base px-1 rounded">video_themes</code>{" "}
          table; the default mirrors the site palette.
        </p>
        <AdminCard>
          <AdminTable headers={["Key", "Label", "Description"]}>
            {themes.map((theme) => (
              <tr key={theme.key} className="border-b border-[var(--divider)] last:border-0">
                <td className="py-3 px-2 font-mono text-xs text-charcoal">{theme.key}</td>
                <td className="py-3 px-2 text-charcoal">{theme.label}</td>
                <td className="py-3 px-2 text-secondary">{theme.description}</td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      </section>

      <section>
        <h2 className="font-heading text-lg font-bold text-charcoal mb-1">B-roll cache</h2>
        <p className="text-sm text-secondary mb-4">
          Screenshots of the live site captured for <code className="bg-base px-1 rounded">broll_page</code> scenes.
          Entries expire after 14 days so a stale capture never outlives a redesign — an expired row
          is simply re-captured on the next render.
        </p>
        {broll.length === 0 ? (
          <AdminEmptyState message="Nothing captured yet. Tick “Include a real-page shot” when creating a video, or run npm run video:capture." />
        ) : (
          <AdminCard>
            <AdminTable headers={["Page", "Kind", "Size", "Captured", "Expires", ""]}>
              {broll.map((row) => {
                const expired = new Date(row.expires_at).getTime() < Date.now();
                return (
                  <tr key={row.id} className="border-b border-[var(--divider)] last:border-0">
                    <td className="py-3 px-2 text-charcoal break-all max-w-xs">{row.source_url}</td>
                    <td className="py-3 px-2 text-secondary">{row.capture_kind.replace(/_/g, " ")}</td>
                    <td className="py-3 px-2 text-secondary whitespace-nowrap">
                      {row.viewport_w}×{row.viewport_h}
                    </td>
                    <td className="py-3 px-2 text-secondary whitespace-nowrap">
                      {new Date(row.captured_at).toLocaleDateString()}
                    </td>
                    <td className={`py-3 px-2 whitespace-nowrap ${expired ? "text-primary" : "text-secondary"}`}>
                      {expired ? "expired" : new Date(row.expires_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-2">
                      <a
                        href={row.asset_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline text-xs"
                      >
                        View
                      </a>
                    </td>
                  </tr>
                );
              })}
            </AdminTable>
          </AdminCard>
        )}
      </section>
    </div>
  );
}
