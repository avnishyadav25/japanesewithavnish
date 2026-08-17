"use client";

import { useMemo, useState } from "react";
import { AdminCard } from "@/components/admin/AdminCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { MaybeSocialIcon } from "@/components/icons/SocialIcons";
import { countChars } from "@/lib/social/clamp";
import { primaryText, shareIntentUrl, type ChannelCapabilityReport } from "@/lib/social/adapters";
import {
  PLATFORM_RULES,
  SOCIAL_LANGS,
  SURFACES,
  getRule,
  type PlatformId,
  type SocialLang,
  type SurfaceId,
} from "@/lib/social/platforms";
import type {
  SocialBriefRow,
  SocialChannelPublic,
  SocialPostRow,
  SocialVariantRow,
} from "@/lib/social/types";

type PostWithMeta = SocialPostRow & { platform: PlatformId; surface: string; lang: string };

/**
 * The per-surface workspace.
 *
 * Deliberately not a modal inside ProjectWorkspace.tsx: that file is already 900+ lines carrying
 * three concerns, and a social panel growing inside it would make every future video change
 * riskier. The render card gets one button that links here.
 */
export function BriefWorkspace({
  brief,
  initialVariants,
  channels,
  capabilities,
  initialPosts,
}: {
  brief: SocialBriefRow;
  initialVariants: SocialVariantRow[];
  channels: SocialChannelPublic[];
  capabilities: ChannelCapabilityReport[];
  initialPosts: PostWithMeta[];
}) {
  const [variants, setVariants] = useState(initialVariants);
  const [posts, setPosts] = useState(initialPosts);
  const [selected, setSelected] = useState<SurfaceId[]>(["instagram.reel", "x.post", "youtube.short"]);
  const [langs, setLangs] = useState<SocialLang[]>([...SOCIAL_LANGS]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const capabilityByPlatform = useMemo(
    () => new Map(capabilities.map((c) => [c.platform, c])),
    [capabilities]
  );
  const channelByPlatform = useMemo(() => new Map(channels.map((c) => [c.platform, c])), [channels]);

  /** Variants grouped by surface, so each card can show its EN/Hinglish tabs. */
  const bySurface = useMemo(() => {
    const map = new Map<SurfaceId, Partial<Record<SocialLang, SocialVariantRow>>>();
    for (const v of variants) {
      const entry = map.get(v.surface) ?? {};
      entry[v.lang] = v;
      map.set(v.surface, entry);
    }
    return map;
  }, [variants]);

  const postByVariant = useMemo(() => new Map(posts.map((p) => [p.variantId, p])), [posts]);

  async function call(url: string, body?: unknown, method = "POST") {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? `${res.status}`);
    return json;
  }

  /** Re-reads current variants. Shared by generate and by restoring an earlier version. */
  async function reloadVariants() {
    try {
      const refreshed = await call(`/api/admin/social/briefs/${brief.id}/variants`, undefined, "GET");
      setVariants(refreshed.variants);
      if (refreshed.posts) setPosts(refreshed.posts);
    } catch {
      // A failed refresh leaves the current view alone rather than blanking it.
    }
  }

  async function generate() {
    if (selected.length === 0) return;
    setBusy("generate");
    setError(null);
    setNotice(null);
    try {
      const out = await call(`/api/admin/social/briefs/${brief.id}/generate`, { surfaces: selected, langs });
      const refreshed = await call(`/api/admin/social/briefs/${brief.id}/variants`, undefined, "GET");
      setVariants(refreshed.variants);
      const failures = (out.results ?? []).filter((r: { status: string }) => r.status === "failed");
      setNotice(
        `Generated ${out.results.length - failures.length}/${out.results.length} surfaces · $${Number(out.estimatedCostUsd).toFixed(4)}` +
          (failures.length ? ` — failed: ${failures.map((f: { surface: string }) => f.surface).join(", ")}` : "")
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setBusy(null);
    }
  }

  async function queue(variant: SocialVariantRow) {
    setBusy(variant.id);
    setError(null);
    try {
      const out = await call(`/api/admin/social/variants/${variant.id}/queue`, {});
      setPosts((prev) => [
        { ...out.post, platform: variant.platform, surface: variant.surface, lang: variant.lang },
        ...prev.filter((p) => p.id !== out.post.id),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not queue");
    } finally {
      setBusy(null);
    }
  }

  async function markPosted(post: PostWithMeta, url: string) {
    setBusy(post.id);
    setError(null);
    try {
      const out = await call(`/api/admin/social/posts/${post.id}/mark-posted`, { externalUrl: url });
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, ...out.post } : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record");
    } finally {
      setBusy(null);
    }
  }

  async function publishArticle(variant: SocialVariantRow) {
    setBusy(variant.id);
    setError(null);
    setNotice(null);
    try {
      const out = await call(`/api/admin/social/variants/${variant.id}/publish-now`, {});
      setNotice(out.notice ?? "Draft created.");
      const refreshed = await call(`/api/admin/social/briefs/${brief.id}/variants`, undefined, "GET");
      setPosts(refreshed.posts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the draft");
    } finally {
      setBusy(null);
    }
  }

  const surfacesWithContent = SURFACES.filter((s) => bySurface.has(s));

  return (
    <div className="space-y-6">
      {/* -------- Facts + generate bar -------- */}
      <AdminCard>
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div className="text-sm text-secondary space-y-1">
            <div>
              <span className="text-charcoal font-medium">{brief.contentType ?? "content"}</span>
              {brief.jlptLevel ? ` · ${brief.jlptLevel}` : ""}
              {brief.summary ? ` · ${brief.summary}` : ""}
            </div>
            {brief.utmCampaign && <div className="text-xs">utm_campaign={brief.utmCampaign}</div>}
          </div>
          <StatusBadge status={brief.status} />
        </div>

        <div className="border-t border-[var(--divider)] pt-4">
          <div className="text-xs uppercase tracking-wider text-secondary font-semibold mb-3">
            Generate for
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {SURFACES.map((s) => {
              const on = selected.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelected((prev) => (on ? prev.filter((x) => x !== s) : [...prev, s]))}
                  className={`px-3 py-1.5 rounded-bento text-sm border transition inline-flex items-center gap-2 ${
                    on
                      ? "border-primary text-primary bg-red-light"
                      : "border-[var(--divider)] text-secondary hover:border-primary hover:text-primary"
                  }`}
                >
                  <MaybeSocialIcon platform={PLATFORM_RULES[s].platform} className="w-3.5 h-3.5" />
                  {PLATFORM_RULES[s].label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-2">
              {SOCIAL_LANGS.map((l) => (
                <label key={l} className="text-sm text-secondary inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={langs.includes(l)}
                    onChange={() =>
                      setLangs((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]))
                    }
                  />
                  {l === "en" ? "English" : "Hinglish"}
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={generate}
              disabled={busy === "generate" || selected.length === 0 || langs.length === 0}
              className="btn-primary disabled:opacity-50"
            >
              {busy === "generate" ? "Writing…" : `Generate ${selected.length} surface${selected.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-primary">{error}</p>}
        {notice && <p className="mt-3 text-sm text-secondary">{notice}</p>}
      </AdminCard>

      {/* -------- One card per surface -------- */}
      {surfacesWithContent.length === 0 ? (
        <AdminCard>
          <p className="text-sm text-secondary">
            Nothing generated yet. Pick the surfaces above and click Generate — both an English and a
            Hinglish version are written for each, and you choose which to post.
          </p>
        </AdminCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {surfacesWithContent.map((surface) => (
            <SurfaceCard
              key={surface}
              surface={surface}
              variants={bySurface.get(surface)!}
              postByVariant={postByVariant}
              capability={capabilityByPlatform.get(getRule(surface).platform)}
              channel={channelByPlatform.get(getRule(surface).platform)}
              busy={busy}
              onQueue={queue}
              onMarkPosted={markPosted}
              onPublishArticle={publishArticle}
              onRestored={reloadVariants}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SurfaceCard({
  surface,
  variants,
  postByVariant,
  capability,
  channel,
  busy,
  onQueue,
  onMarkPosted,
  onPublishArticle,
  onRestored,
}: {
  surface: SurfaceId;
  variants: Partial<Record<SocialLang, SocialVariantRow>>;
  postByVariant: Map<string, PostWithMeta>;
  capability?: ChannelCapabilityReport;
  channel?: SocialChannelPublic;
  busy: string | null;
  onQueue: (v: SocialVariantRow) => void;
  onMarkPosted: (p: PostWithMeta, url: string) => void;
  onPublishArticle: (v: SocialVariantRow) => void;
  onRestored: () => void;
}) {
  const rule = getRule(surface);
  const available = SOCIAL_LANGS.filter((l) => variants[l]);
  const [lang, setLang] = useState<SocialLang>(available[0] ?? "en");
  const [pasteUrl, setPasteUrl] = useState("");
  const [history, setHistory] = useState<
    { id: string; version: number; isCurrent: boolean; source: string; createdAt: string; preview: string; mediaCount: number }[] | null
  >(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const variant = variants[lang];

  /**
   * Earlier drafts of this surface.
   *
   * Loaded on demand rather than with the page: fifteen surfaces times two languages would be
   * thirty extra queries to render a list most of which nobody opens.
   */
  async function loadHistory(variantId: string) {
    setHistoryBusy(true);
    try {
      const res = await fetch(`/api/admin/social/variants/${variantId}/history`);
      const data = await res.json();
      setHistory(data.versions ?? []);
    } finally {
      setHistoryBusy(false);
    }
  }

  async function restore(versionId: string, variantId: string) {
    setHistoryBusy(true);
    try {
      await fetch(`/api/admin/social/variants/${variantId}/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      });
      setHistory(null);
      onRestored();
    } finally {
      setHistoryBusy(false);
    }
  }

  if (!variant) return null;
  const post = postByVariant.get(variant.id);
  const text = primaryText(surface, variant.content, variant.hashtags);
  const intent = shareIntentUrl(rule.platform, { text, url: null });

  return (
    <AdminCard>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <MaybeSocialIcon platform={rule.platform} className="w-4 h-4 text-charcoal" />
          <span className="font-heading font-bold text-charcoal">{rule.label}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Version, and a way back to earlier ones. Nothing is ever deleted — saveVariant
              supersedes and inserts — but until now the workspace only loaded is_current, so a
              regenerate that produced worse copy than the attempt before it was unrecoverable
              without a SQL client. */}
          {variant.version > 1 && (
            <button
              type="button"
              onClick={() => (history ? setHistory(null) : loadHistory(variant.id))}
              disabled={historyBusy}
              title="Earlier drafts of this surface. They are all still stored."
              className="text-xs text-secondary hover:text-primary disabled:opacity-50"
            >
              v{variant.version} · {history ? "hide" : "history"}
            </button>
          )}
          {post ? <StatusBadge status={post.status} /> : null}
        </div>
      </div>

      {history && (
        <div className="mb-3 border border-[var(--divider)] rounded-card divide-y divide-[var(--divider)]">
          {history.length === 0 && <p className="px-3 py-2 text-xs text-secondary">No earlier drafts.</p>}
          {history.map((h) => (
            <div key={h.id} className="px-3 py-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-charcoal">v{h.version}</span>
                {h.isCurrent ? (
                  <span className="text-emerald-700">current</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => restore(h.id, variant.id)}
                    disabled={historyBusy}
                    className="text-primary hover:underline disabled:opacity-50"
                  >
                    restore
                  </button>
                )}
                <span className="text-secondary">{h.source.replace(/_/g, " ")}</span>
                {h.mediaCount > 0 && <span className="text-secondary">· {h.mediaCount} image</span>}
                <span className="text-secondary ml-auto">{new Date(h.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-secondary mt-0.5 line-clamp-2">{h.preview}</p>
            </div>
          ))}
        </div>
      )}

      {available.length > 1 && (
        <div className="flex gap-1 mb-3">
          {available.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`px-2.5 py-1 rounded-badge text-xs font-medium transition ${
                l === lang ? "bg-primary text-white" : "bg-base text-secondary hover:text-primary"
              }`}
            >
              {l === "en" ? "English" : "Hinglish"}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {rule.fields.map((field) => {
          const value = variant.content[field.key];
          if (value === undefined) return null;

          if (Array.isArray(value)) {
            return (
              <div key={field.key}>
                <FieldLabel label={field.label} note={`${value.length} items`} />
                <ol className="text-sm text-charcoal space-y-1 list-decimal list-inside">
                  {value.map((item, i) => (
                    <li key={i} className="whitespace-pre-wrap">
                      {typeof item === "string" ? item : [item.title, item.body].filter(Boolean).join(" — ")}
                    </li>
                  ))}
                </ol>
              </div>
            );
          }
          if (typeof value !== "string") return null;

          const n = countChars(value);
          const over = n > field.maxChars;
          return (
            <div key={field.key}>
              <FieldLabel
                label={field.label}
                note={`${n} / ${field.maxChars}`}
                // The live counter is grapheme-based, matching what the platform counts, so an
                // emoji-heavy caption reads the same here as it will on the platform.
                danger={over}
              />
              <p className="text-sm text-charcoal whitespace-pre-wrap">{value}</p>
            </div>
          );
        })}

        {variant.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {variant.hashtags.map((tag) => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded-badge bg-base text-secondary">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* What enforcement changed. Silent trimming is how you find out at post time that the
          CTA was cut off, so it is shown rather than swallowed. */}
      {variant.clampReport.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-[var(--divider)] pt-3">
          {variant.clampReport.map((v, i) => (
            <li key={i} className={`text-xs ${v.action === "rejected" ? "text-primary" : "text-amber-700"}`}>
              {v.note ?? `${v.field}: ${v.was} / ${v.limit}`}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 pt-3 border-t border-[var(--divider)] flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(text)}
          className="text-sm px-3 py-1.5 rounded-button border border-[var(--divider)] text-secondary hover:border-primary hover:text-primary transition"
        >
          Copy
        </button>
        {intent && (
          <a
            href={intent}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm px-3 py-1.5 rounded-button border border-[var(--divider)] text-secondary hover:border-primary hover:text-primary transition"
          >
            Open {rule.platform} ↗
          </a>
        )}
        {/* The one surface that publishes to somewhere we own, so it goes straight through
            instead of round-tripping through a copy-and-paste. Still lands as a DRAFT. */}
        {surface === "blog.article" ? (
          <button
            type="button"
            onClick={() => onPublishArticle(variant)}
            disabled={busy === variant.id}
            className="text-sm px-3 py-1.5 rounded-button bg-primary text-white disabled:opacity-50"
          >
            {busy === variant.id ? "Creating…" : "Create blog draft"}
          </button>
        ) : (
          !post && (
            <button
              type="button"
              onClick={() => onQueue(variant)}
              disabled={busy === variant.id || !channel}
              className="text-sm px-3 py-1.5 rounded-button bg-charcoal text-white disabled:opacity-50"
            >
              {busy === variant.id ? "…" : "Mark for posting"}
            </button>
          )
        )}
      </div>

      {post && post.status !== "published" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="url"
            value={pasteUrl}
            onChange={(e) => setPasteUrl(e.target.value)}
            placeholder="Paste the live URL once posted"
            className="flex-1 min-w-[200px] px-3 py-1.5 text-sm border border-[var(--divider)] rounded-bento"
          />
          <button
            type="button"
            onClick={() => onMarkPosted(post, pasteUrl)}
            disabled={!pasteUrl.trim() || busy === post.id}
            className="text-sm px-3 py-1.5 rounded-button bg-primary text-white disabled:opacity-50"
          >
            Mark posted
          </button>
        </div>
      )}

      {post?.externalUrl && (
        <p className="mt-3 text-xs text-secondary">
          Live at{" "}
          <a href={post.externalUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
            {post.externalUrl}
          </a>
        </p>
      )}

      {/* Auto-post is off for every platform until its approval lands. Say why, rather than
          showing a disabled button with no explanation. */}
      {capability && !capability.autoPost && capability.reason && (
        <p className="mt-3 text-xs text-secondary border-t border-[var(--divider)] pt-3">{capability.reason}</p>
      )}
    </AdminCard>
  );
}

function FieldLabel({ label, note, danger }: { label: string; note: string; danger?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 mb-1">
      <span className="text-xs uppercase tracking-wider text-secondary font-semibold">{label}</span>
      <span className={`text-xs tabular-nums ${danger ? "text-primary font-semibold" : "text-secondary"}`}>{note}</span>
    </div>
  );
}
