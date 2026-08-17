"use client";

import { useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";
import { VOICE_CATALOGUE } from "@/lib/video/voices";
import type { NarrationLang } from "@/lib/video/types";

/**
 * Editing for `video_themes`, which previously had none — the page said "edit these in the
 * video_themes table", which was true and is not a user interface.
 *
 * Colours are swatches because a hex field you cannot see is a hex field you get wrong; fonts are
 * free text because a font stack legitimately contains quotes, commas and fallbacks.
 *
 * Duplicate is the primary action rather than an afterthought: the three seeded themes are what
 * every project defaults to, and the safe way to try a variant is to copy one.
 */
export interface ThemeRow {
  key: string;
  label: string;
  description: string | null;
  tokens: Record<string, unknown>;
  defaultVoices: Record<string, unknown>;
  isEnabled: boolean;
  usageCount: number;
}

const COLOUR_TOKENS = [
  ["bg", "Background"],
  ["surface", "Cards"],
  ["text", "Text"],
  ["textMuted", "Muted text"],
  ["textSubtle", "Subtle text"],
  ["primary", "Accent"],
  ["primaryHover", "Accent hover"],
  ["accent", "Secondary accent"],
  ["border", "Borders"],
] as const;

const FONT_TOKENS = [
  ["fontSans", "Sans"],
  ["fontSerif", "Serif / headings"],
  ["fontJa", "Japanese"],
] as const;

export function ThemeEditor({ initial }: { initial: ThemeRow[] }) {
  const [themes, setThemes] = useState(initial);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function patchLocal(key: string, patch: Partial<ThemeRow>) {
    setThemes((prev) => prev.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  }

  async function save(theme: ThemeRow) {
    setBusy(theme.key);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/video/themes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: theme.key,
          label: theme.label,
          description: theme.description,
          tokens: theme.tokens,
          defaultVoices: theme.defaultVoices,
          isEnabled: theme.isEnabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      patchLocal(theme.key, { tokens: data.tokens, defaultVoices: data.defaultVoices });
      setNotice(`Saved ${theme.label}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(null);
    }
  }

  async function duplicate(theme: ThemeRow) {
    const label = window.prompt(`Name for the copy of "${theme.label}"?`, `${theme.label} copy`);
    if (!label) return;
    setBusy(theme.key);
    setError(null);
    try {
      const res = await fetch("/api/admin/video/themes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: label, label, copyFrom: theme.key, description: `Based on ${theme.label}` }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not duplicate");
      const listed = await (await fetch("/api/admin/video/themes")).json();
      setThemes(listed.themes ?? []);
      setNotice(data.message ?? "Duplicated.");
      setOpenKey(data.key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not duplicate");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminCard>
      <p className="text-xs text-secondary mb-4">
        Colours and fonts for the scene templates. Editing a theme changes every future render that
        uses it; finished videos are unaffected until re-rendered.
      </p>

      {notice && <p className="text-xs text-emerald-700 mb-3">{notice}</p>}
      {error && <p className="text-xs text-primary mb-3">{error}</p>}

      <div className="divide-y divide-[var(--divider)]">
        {themes.map((theme) => {
          const open = openKey === theme.key;
          const tokens = theme.tokens as Record<string, string>;
          return (
            <div key={theme.key} className="py-3">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => setOpenKey(open ? null : theme.key)}
                  className="flex items-center gap-3 text-left flex-1 min-w-0"
                >
                  {/* Swatch strip: the fastest way to tell two themes apart at a glance. */}
                  <span className="flex shrink-0 rounded-badge overflow-hidden border border-[var(--divider)]">
                    {["bg", "surface", "text", "primary", "accent"].map((k) => (
                      <span key={k} style={{ background: tokens[k] ?? "#fff", width: 16, height: 16 }} />
                    ))}
                  </span>
                  <span className="min-w-0">
                    <span className="text-sm font-semibold text-charcoal">{theme.label}</span>
                    <span className="ml-2 text-xs text-secondary font-mono">{theme.key}</span>
                  </span>
                </button>
                <span className="text-xs text-secondary shrink-0">
                  {theme.usageCount} project{theme.usageCount === 1 ? "" : "s"}
                </span>
                {!theme.isEnabled && <span className="text-xs text-amber-700 shrink-0">disabled</span>}
                <button
                  type="button"
                  onClick={() => duplicate(theme)}
                  disabled={busy !== null}
                  className="text-xs text-primary hover:underline shrink-0 disabled:opacity-50"
                >
                  duplicate
                </button>
              </div>

              {open && (
                <div className="mt-4 space-y-4 pl-1">
                  <div className="grid sm:grid-cols-2 gap-3">
                    {COLOUR_TOKENS.map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 text-sm">
                        <input
                          type="color"
                          value={/^#[0-9a-f]{6}$/i.test(tokens[key] ?? "") ? tokens[key] : "#ffffff"}
                          onChange={(e) => patchLocal(theme.key, { tokens: { ...tokens, [key]: e.target.value } })}
                          className="w-8 h-8 rounded border border-[var(--divider)] shrink-0"
                        />
                        <span className="text-charcoal flex-1">{label}</span>
                        <span className="text-xs text-secondary font-mono">{tokens[key] ?? "—"}</span>
                      </label>
                    ))}
                  </div>

                  {FONT_TOKENS.map(([key, label]) => (
                    <label key={key} className="block text-sm">
                      <span className="text-charcoal font-medium">{label}</span>
                      <input
                        type="text"
                        value={tokens[key] ?? ""}
                        onChange={(e) => patchLocal(theme.key, { tokens: { ...tokens, [key]: e.target.value } })}
                        className="mt-1 w-full border border-[var(--divider)] rounded-button px-3 py-1.5 text-sm font-mono"
                      />
                    </label>
                  ))}

                  <div className="grid sm:grid-cols-3 gap-3">
                    {(["en", "hi", "ja"] as NarrationLang[]).map((lang) => (
                      <label key={lang} className="block text-sm">
                        <span className="text-charcoal font-medium uppercase text-xs">{lang} voice</span>
                        <select
                          value={String((theme.defaultVoices as Record<string, string>)[lang] ?? "")}
                          onChange={(e) =>
                            patchLocal(theme.key, {
                              defaultVoices: { ...theme.defaultVoices, [lang]: e.target.value },
                            })
                          }
                          className="mt-1 w-full border border-[var(--divider)] rounded-button px-2 py-1.5 text-sm"
                        >
                          {(VOICE_CATALOGUE[lang] ?? []).map((v) => (
                            <option key={v.name} value={v.name}>
                              {v.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>

                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => save(theme)}
                      disabled={busy === theme.key}
                      className="btn-primary text-sm disabled:opacity-50"
                    >
                      {busy === theme.key ? "Saving…" : "Save"}
                    </button>
                    <label
                      className="flex items-center gap-2 text-sm text-secondary"
                      title={
                        theme.usageCount > 0
                          ? "Projects use this theme — move them first. theme_key is a foreign key."
                          : undefined
                      }
                    >
                      <input
                        type="checkbox"
                        checked={theme.isEnabled}
                        disabled={theme.usageCount > 0 && theme.isEnabled}
                        onChange={(e) => patchLocal(theme.key, { isEnabled: e.target.checked })}
                      />
                      Available in the wizard
                    </label>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AdminCard>
  );
}
