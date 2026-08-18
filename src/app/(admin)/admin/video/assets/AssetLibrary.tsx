"use client";

/**
 * The sticker / character / texture library, and the mascot cast.
 *
 * WHY IT LIVES HERE. This page is already called "Music & Assets" in the sidebar and already holds
 * music, themes and the b-roll cache. Stickers belong in the same drawer; a second assets page
 * would split one job across two places. Mascots are repeated here (Brand Check also shows them)
 * because the count is the thing you act on — "8 of 16" is a prompt to run the generator, and you
 * should see it on the page where you manage assets, not only on the page about branding.
 *
 * The grid sits on a CHECKERBOARD, copied from BrandAssets for the reason stated there: these are
 * transparent cut-outs, and a white page hides a failed chroma key completely — which is the exact
 * defect the generator's matte step exists to catch.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { GENERATED, MASCOTS, mascotAsset, type MascotId } from "@/lib/video/mascots";

interface Asset {
  id: string;
  slug: string;
  category: string;
  label: string;
  url: string;
  tags: string[];
  isEnabled: boolean;
}

const CATEGORIES = ["food", "object", "animal", "character", "texture"] as const;

const CHECKERBOARD: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg,#e9e9e9 25%,transparent 25%),linear-gradient(-45deg,#e9e9e9 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e9e9e9 75%),linear-gradient(-45deg,transparent 75%,#e9e9e9 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0,0 8px,8px -8px,-8px 0px",
};

export function AssetLibrary() {
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/video/assets");
      const text = await res.text();
      if (!res.ok) throw new Error(text.slice(0, 200) || `Request failed (${res.status})`);
      setAssets(JSON.parse(text).assets ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the asset library");
      setAssets([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of assets ?? []) map[a.category] = (map[a.category] ?? 0) + 1;
    return map;
  }, [assets]);

  const shown = (assets ?? []).filter((a) => !filter || a.category === filter);

  async function toggle(asset: Asset) {
    setBusy(asset.id);
    try {
      const res = await fetch("/api/admin/video/assets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: asset.id, isEnabled: !asset.isEnabled }),
      });
      if (!res.ok) throw new Error((await res.text()).slice(0, 160));
      setAssets((prev) => (prev ?? []).map((a) => (a.id === asset.id ? { ...a, isEnabled: !a.isEnabled } : a)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update that asset");
    } finally {
      setBusy(null);
    }
  }

  const missingMascots = MASCOTS.filter((m) => !GENERATED.includes(m));

  return (
    <div className="space-y-8">
      {error && <p className="text-sm text-primary">{error}</p>}

      {/* ---- mascots ------------------------------------------------------ */}
      <div>
        <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
          <h3 className="font-semibold text-charcoal">Mascot cast</h3>
          <span className="text-sm text-secondary tabular-nums">
            {GENERATED.length} of {MASCOTS.length} generated
          </span>
        </div>
        <p className="text-sm text-secondary mb-3">
          {missingMascots.length === 0 ? (
            <>Every character has art. Videos cast one per content type &mdash; owl for grammar, tanuki for kanji, fox for vocabulary.</>
          ) : (
            <>
              {missingMascots.length} character{missingMascots.length === 1 ? "" : "s"} still fall back to the fox. Run{" "}
              <code className="text-xs">npm run video:mascots</code>, check the contact sheet, then{" "}
              <code className="text-xs">npm run video:mascots -- --promote</code>. The <code className="text-xs">--</code> matters.
            </>
          )}
        </p>
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3 p-3 rounded-card" style={CHECKERBOARD}>
          {MASCOTS.map((id: MascotId) => {
            const has = GENERATED.includes(id);
            return (
              <div key={id} className="text-center">
                {has ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/${mascotAsset(id)}`} alt={id} className="w-full h-20 object-contain" />
                ) : (
                  <div className="w-full h-20 flex items-center justify-center text-2xl opacity-25">?</div>
                )}
                <div className="text-[10px] mt-1 text-charcoal/70 truncate">{id}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---- stickers ----------------------------------------------------- */}
      <div>
        <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
          <h3 className="font-semibold text-charcoal">Characters &amp; stickers</h3>
          <span className="text-sm text-secondary tabular-nums">{(assets ?? []).length} in the library</span>
        </div>

        {assets === null ? (
          <p className="text-sm text-secondary">Loading&hellip;</p>
        ) : assets.length === 0 ? (
          <p className="text-sm text-secondary">
            Nothing uploaded yet. <code className="text-xs">npm run video:assets</code> generates the set and writes a
            contact sheet; <code className="text-xs">npm run video:assets -- --promote</code> uploads the cells you kept.
            Nothing reaches R2 until you promote.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {([
                { label: "All", value: undefined, badge: assets.length },
                ...CATEGORIES.map((c) => ({ label: c[0].toUpperCase() + c.slice(1), value: c, badge: counts[c] ?? 0 })),
              ] as { label: string; value?: string; badge: number }[]).map((o) => {
                const on = filter === o.value;
                return (
                  <button
                    key={o.label}
                    type="button"
                    onClick={() => setFilter(o.value)}
                    className={`px-3 py-1.5 rounded-button text-sm border transition ${
                      on
                        ? "border-primary bg-red-light text-primary font-semibold"
                        : "border-[var(--divider)] text-secondary hover:border-primary/40"
                    }`}
                  >
                    {o.label}
                    <span className="ml-1.5 text-xs tabular-nums opacity-70">{o.badge}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-3 p-3 rounded-card" style={CHECKERBOARD}>
              {shown.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => void toggle(a)}
                  disabled={busy === a.id}
                  title={`${a.label} — ${a.tags.join(", ") || "no tags"}. Click to ${a.isEnabled ? "disable" : "enable"}.`}
                  className={`text-center transition ${a.isEnabled ? "" : "opacity-30 grayscale"} ${
                    busy === a.id ? "animate-pulse" : "hover:scale-105"
                  }`}
                >
                  {/* A raw img, not next/image: these are R2 urls the optimiser gains nothing on. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url} alt={a.label} loading="lazy" className="w-full h-20 object-contain" />
                  <div className="text-[10px] mt-1 text-charcoal/70 truncate">{a.slug}</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-secondary mt-2">
              Click any asset to disable it &mdash; it stops being picked for new videos, and already-rendered videos
              keep the one they froze. Stickers appear on Shorts only; a lesson frame is dense enough already.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
