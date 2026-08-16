"use client";

import { useEffect, useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";
import { GENERATED, MASCOTS, mascotAsset, type MascotId } from "@/lib/video/mascots";
import { SOCIALS } from "@/lib/brand";
import { MaybeSocialIcon } from "@/components/icons/SocialIcons";

interface ThemeRow {
  key: string;
  label: string;
  tokens: Record<string, string>;
  usageCount: number;
}

/**
 * Every brand asset the video tree can draw, on one page.
 *
 * The rendered-frame grid below this shows what a video LOOKS like; this shows what is available
 * to put in one. They answer different questions — "is the outro right" versus "which characters
 * do I actually have" — and the second had no answer anywhere before.
 *
 * Mascots without artwork are shown greyed rather than hidden: knowing a character is declared
 * but not yet generated is the useful state, and hiding it makes the generator's job invisible.
 */
export function BrandAssets() {
  const [themes, setThemes] = useState<ThemeRow[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/video/themes");
        const data = await res.json();
        setThemes(data.themes ?? []);
      } catch {
        setThemes([]);
      }
    })();
  }, []);

  const missing = MASCOTS.filter((m) => !GENERATED.includes(m));

  return (
    <div className="space-y-6 mb-8">
      {/* -------- Characters -------- */}
      <AdminCard>
        <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
          <h2 className="font-heading text-lg font-bold text-charcoal">Characters</h2>
          <span className="text-xs text-secondary">
            {GENERATED.length} of {MASCOTS.length} generated
          </span>
        </div>
        {missing.length > 0 && (
          <p className="text-xs text-secondary mb-3">
            {missing.length} declared without artwork. Generate them with{" "}
            <code className="bg-base px-1 rounded">npm run video:mascots</code> — it writes a contact
            sheet first and only copies into <code className="bg-base px-1 rounded">public/</code> on{" "}
            <code className="bg-base px-1 rounded">--promote</code>.
          </p>
        )}
        {/* Checkerboard, because these are transparent PNGs and a white page hides a failed
            chroma key completely — the exact defect the generator's matte step exists to avoid. */}
        <div
          className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-3 p-3 rounded-card"
          style={{
            backgroundImage:
              "linear-gradient(45deg,#e9e9e9 25%,transparent 25%),linear-gradient(-45deg,#e9e9e9 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e9e9e9 75%),linear-gradient(-45deg,transparent 75%,#e9e9e9 75%)",
            backgroundSize: "16px 16px",
            backgroundPosition: "0 0,0 8px,8px -8px,-8px 0px",
          }}
        >
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
                <div className={`text-[10px] mt-1 ${has ? "text-charcoal" : "text-secondary opacity-60"}`}>
                  {id}
                </div>
              </div>
            );
          })}
        </div>
      </AdminCard>

      {/* -------- Logos and icons -------- */}
      <div className="grid sm:grid-cols-2 gap-6">
        <AdminCard>
          <h2 className="font-heading text-lg font-bold text-charcoal mb-3">Logos</h2>
          <div className="flex items-center gap-6">
            {[
              ["badge", "/logo.png"],
              ["symbol", "/logo-dark.png"],
            ].map(([variant, src]) => (
              <div key={variant} className="text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={variant} className="w-16 h-16 object-contain mx-auto" />
                <div className="text-xs text-secondary mt-1">{variant}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-secondary mt-3">
            <code className="bg-base px-1 rounded">logo-dark.png</code> is misleadingly named — it is
            the stripped symbol, not a dark-mode variant.
          </p>
        </AdminCard>

        <AdminCard>
          <h2 className="font-heading text-lg font-bold text-charcoal mb-3">Outro socials</h2>
          <div className="flex items-center gap-3 flex-wrap">
            {SOCIALS.filter((s) => s.inVideoOutro).map((s) => (
              <span key={s.platform} className="inline-flex items-center gap-1.5 text-sm text-charcoal">
                <MaybeSocialIcon platform={s.platform as never} className="w-4 h-4" />
                {s.platform}
              </span>
            ))}
          </div>
          <p className="text-xs text-secondary mt-3">
            Only confirmed accounts appear. Unconfirmed ones are deliberately never linked or
            declared in schema.
          </p>
        </AdminCard>
      </div>

      {/* -------- Themes -------- */}
      <AdminCard>
        <h2 className="font-heading text-lg font-bold text-charcoal mb-3">Themes</h2>
        {themes.length === 0 ? (
          <p className="text-sm text-secondary">Loading…</p>
        ) : (
          <div className="grid sm:grid-cols-3 gap-4">
            {themes.map((t) => (
              <div key={t.key} className="border border-[var(--divider)] rounded-card overflow-hidden">
                <div
                  className="p-4"
                  style={{ background: t.tokens.bg ?? "#fff", color: t.tokens.text ?? "#111" }}
                >
                  <div style={{ fontFamily: t.tokens.fontSerif, fontWeight: 700, fontSize: 18 }}>
                    ねこ
                  </div>
                  <div style={{ fontFamily: t.tokens.fontSans, fontSize: 12, color: t.tokens.textMuted }}>
                    neko · cat
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: t.tokens.primary ?? "#c00",
                      color: "#fff",
                      fontSize: 11,
                    }}
                  >
                    JLPT N5
                  </div>
                </div>
                <div className="px-3 py-2 text-xs flex items-center justify-between">
                  <span className="text-charcoal font-medium">{t.label}</span>
                  <span className="text-secondary">{t.usageCount} used</span>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-secondary mt-3">
          Edit colours, fonts and default voices in{" "}
          <a href="/admin/video/assets" className="text-primary hover:underline">
            Music &amp; Assets
          </a>
          .
        </p>
      </AdminCard>
    </div>
  );
}
