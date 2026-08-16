"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";
import { FilterPills } from "@/components/admin/FilterPills";

/**
 * The B-roll cache, with thumbnails and cleanup.
 *
 * It was a read-only table of urls and pixel dimensions. The one thing you actually need to know
 * about a capture — whether it shows the real page or a logged-out paywall — is only visible by
 * looking at it, and there was no way to delete a bad one.
 *
 * Deleting is always safe: entries expire after 14 days and are re-captured on the next render
 * that needs them, so the worst case is one extra browser launch.
 */
interface BrollAsset {
  id: string;
  sourceUrl: string;
  captureKind: string;
  width: number;
  height: number;
  assetUrl: string;
  durationSeconds: number | null;
  capturedAt: string;
  expiresAt: string;
  isExpired: boolean;
}

interface Totals {
  total: number;
  expired: number;
  stills: number;
  clips: number;
  seconds: number;
}

export function BrollLibrary({ brollEnabled }: { brollEnabled: boolean }) {
  const [assets, setAssets] = useState<BrollAsset[]>([]);
  const [totals, setTotals] = useState<Totals>({ total: 0, expired: 0, stills: 0, clips: 0, seconds: 0 });
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter === "expired") params.set("expired", "true");
      else if (filter) params.set("kind", filter);
      const res = await fetch(`/api/admin/video/broll?${params}`);
      const data = await res.json();
      setAssets(data.assets ?? []);
      setTotals(data.totals ?? totals);
    } finally {
      setLoading(false);
    }
    // `totals` is only a fallback for a failed response; including it would re-fetch on every load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id?: string) {
    setBusy(id ?? "purge");
    setNotice(null);
    try {
      const qs = id ? `?id=${id}` : "?purge=expired";
      const res = await fetch(`/api/admin/video/broll${qs}`, { method: "DELETE" });
      const data = await res.json();
      setNotice(data.message ?? "Removed.");
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminCard>
      <p className="text-xs text-secondary mb-4">
        Screenshots of the live site captured for <code>broll_page</code> scenes. Entries expire after
        14 days so a stale capture never outlives a redesign — an expired row is simply re-captured on
        the next render.
        {!brollEnabled && (
          <>
            {" "}
            <strong className="text-charcoal">B-roll is off by default</strong>, so an empty cache here
            usually means unused rather than broken — turn it on per project in the new-video wizard.
          </>
        )}
      </p>

      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex flex-wrap gap-2">
          {[
            { label: "All", value: undefined, badge: totals.total },
            { label: "Stills", value: "still", badge: totals.stills },
            { label: "Clips", value: "scroll_clip", badge: totals.clips },
            { label: "Expired", value: "expired", badge: totals.expired },
          ].map((o) => {
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
        {totals.expired > 0 && (
          <button
            type="button"
            onClick={() => remove()}
            disabled={busy !== null}
            className="text-sm text-primary hover:underline disabled:opacity-50"
          >
            Purge {totals.expired} expired
          </button>
        )}
      </div>

      {notice && <p className="text-xs text-emerald-700 mb-3">{notice}</p>}

      {loading ? (
        <p className="text-sm text-secondary">Loading…</p>
      ) : assets.length === 0 ? (
        <p className="text-sm text-secondary">Nothing cached.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map((a) => (
            <div key={a.id} className="border border-[var(--divider)] rounded-card overflow-hidden">
              {/* The whole point: you can see whether the capture is the real page or a paywall.
                  A plain <img> rather than next/image — these are R2 urls that change every
                  fortnight and never repeat, so nothing benefits from the optimiser. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.assetUrl}
                alt={a.sourceUrl}
                loading="lazy"
                className="w-full h-32 object-cover object-top bg-base"
              />
              <div className="p-2.5 text-xs space-y-1">
                <a
                  href={a.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-primary hover:underline truncate"
                  title={a.sourceUrl}
                >
                  {a.sourceUrl.replace(/^https?:\/\/[^/]+/, "")}
                </a>
                <div className="text-secondary">
                  {a.captureKind.replace(/_/g, " ")} · {a.width}×{a.height}
                  {a.durationSeconds ? ` · ${a.durationSeconds.toFixed(1)}s` : ""}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className={a.isExpired ? "text-amber-700" : "text-secondary"}>
                    {a.isExpired ? "expired" : `expires ${new Date(a.expiresAt).toLocaleDateString()}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(a.id)}
                    disabled={busy !== null}
                    className="text-secondary hover:text-primary disabled:opacity-50"
                  >
                    delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminCard>
  );
}
