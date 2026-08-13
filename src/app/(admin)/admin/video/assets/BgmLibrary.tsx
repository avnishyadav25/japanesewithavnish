"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";

export interface BgmTrack {
  id: string;
  title: string;
  audio_url: string;
  duration_seconds: string | number | null;
  mood: string | null;
  license: string;
  attribution: string | null;
  source_url: string | null;
  default_gain_db: string | number;
  is_enabled: boolean;
  created_at: string;
}

const label = "block text-sm font-semibold text-charcoal mb-1.5";
const input =
  "w-full border border-[var(--divider)] rounded-button px-3 py-2 text-sm focus:outline-none focus:border-primary";

/** Reads duration in the browser. Netlify has no ffprobe, and the worker never sees the upload —
 * an <audio> element already knows the answer, so it just gets posted along with the file. */
function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    audio.addEventListener("loadedmetadata", () => done(Number.isFinite(audio.duration) ? audio.duration : null));
    audio.addEventListener("error", () => done(null));
    audio.src = url;
  });
}

interface JamendoResult {
  externalId: string;
  title: string;
  artist: string;
  durationSeconds: number;
  previewUrl: string;
  downloadUrl: string | null;
  license: string;
  licenseUrl: string | null;
  commercialUse: "allowed" | "not_allowed" | "unknown";
  requiresAttribution: boolean;
  sourceUrl: string;
}

interface SourceInfo {
  id: string;
  name: string;
  url: string;
  integration: "api" | "manual";
  licenceSummary: string;
  bestFor: string;
  caveat?: string;
}

export function BgmLibrary({ initialTracks }: { initialTracks: BgmTrack[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [tracks, setTracks] = useState(initialTracks);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"upload" | "url" | "search">("search");

  // Sources + Jamendo search
  const [sources, setSources] = useState<SourceInfo[]>([]);
  const [presets, setPresets] = useState<{ label: string; query: string; mood: string }[]>([]);
  const [jamendoOn, setJamendoOn] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<JamendoResult[]>([]);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const [urlValue, setUrlValue] = useState("");

  useEffect(() => {
    void fetch("/api/admin/video/bgm/search")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setSources(d.sources ?? []);
        setPresets(d.presets ?? []);
        setJamendoOn(Boolean(d.jamendoConfigured));
        if (!d.jamendoConfigured) setMode("url");
      })
      .catch(() => {});
  }, []);

  async function search(q: string) {
    setQuery(q);
    setBusy("search");
    setError(null);
    setSearchNote(null);
    try {
      const res = await fetch("/api/admin/video/bgm/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setResults(data.results ?? []);
      setSearchNote(data.note ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setBusy(null);
    }
  }

  async function importTrack(payload: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch("/api/admin/video/bgm/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setTracks((current) => [data.track, ...current]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(null);
    }
  }
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [license, setLicense] = useState("");
  const [attribution, setAttribution] = useState("");
  const [mood, setMood] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [gain, setGain] = useState(-18);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return setError("Choose an audio file");

    setBusy("upload");
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("title", title);
      form.set("license", license);
      form.set("attribution", attribution);
      form.set("mood", mood);
      form.set("sourceUrl", sourceUrl);
      form.set("defaultGainDb", String(gain));
      const duration = await readDuration(file);
      if (duration) form.set("durationSeconds", String(duration));

      const res = await fetch("/api/admin/video/bgm", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setTracks((current) => [data.track, ...current]);
      setTitle("");
      setLicense("");
      setAttribution("");
      setMood("");
      setSourceUrl("");
      if (fileRef.current) fileRef.current.value = "";
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  async function toggle(track: BgmTrack) {
    setBusy(track.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/video/bgm/${track.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: !track.is_enabled }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setTracks((current) =>
        current.map((t) => (t.id === track.id ? { ...t, is_enabled: !t.is_enabled } : t))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function remove(track: BgmTrack) {
    if (!window.confirm(`Delete “${track.title}”? This removes the file from storage.`)) return;
    setBusy(track.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/video/bgm/${track.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setTracks((current) => current.filter((t) => t.id !== track.id));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-card px-4 py-3 text-sm border bg-red-light border-red-200 text-primary">{error}</div>
      )}

      {tracks.length > 0 && (
        <AdminCard>
          <AdminTable headers={["Track", "Mood", "Length", "Gain", "Licence", "Status", ""]}>
            {tracks.map((track) => (
              <tr key={track.id} className="border-b border-[var(--divider)] last:border-0">
                <td className="py-3 px-2">
                  <div className="text-charcoal font-medium">{track.title}</div>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption -- instrumental music */}
                  <audio src={track.audio_url} controls preload="none" className="h-8 mt-1 max-w-[240px]" />
                </td>
                <td className="py-3 px-2 text-secondary">{track.mood ?? "—"}</td>
                <td className="py-3 px-2 text-secondary whitespace-nowrap">
                  {track.duration_seconds ? `${Math.round(Number(track.duration_seconds))}s` : "—"}
                </td>
                <td className="py-3 px-2 text-secondary whitespace-nowrap">{Number(track.default_gain_db)} dB</td>
                <td className="py-3 px-2 text-secondary max-w-[220px]">
                  <div>{track.license}</div>
                  {track.attribution && <div className="text-xs opacity-70">{track.attribution}</div>}
                  {track.source_url && (
                    <a href={track.source_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                      source
                    </a>
                  )}
                </td>
                <td className="py-3 px-2">
                  <button
                    type="button"
                    onClick={() => toggle(track)}
                    disabled={busy !== null}
                    className={`text-xs px-2 py-1 rounded-badge border ${
                      track.is_enabled
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-[var(--divider)] text-secondary"
                    }`}
                  >
                    {track.is_enabled ? "enabled" : "disabled"}
                  </button>
                </td>
                <td className="py-3 px-2">
                  <button
                    type="button"
                    onClick={() => remove(track)}
                    disabled={busy !== null}
                    className="text-xs text-secondary hover:text-primary disabled:opacity-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      )}

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn-primary">
          Add a track
        </button>
      ) : (
        <AdminCard>
          <div className="flex gap-2 mb-5 flex-wrap">
            {([
              ["search", jamendoOn ? "Search Jamendo" : "Search Jamendo (needs a key)"],
              ["url", "Import from URL"],
              ["upload", "Upload a file"],
            ] as const).map(([value, text]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                disabled={value === "search" && !jamendoOn}
                className={`px-3 py-1.5 rounded-button text-sm border transition disabled:opacity-40 ${
                  mode === value ? "border-primary bg-red-light text-primary font-semibold" : "border-[var(--divider)] text-secondary"
                }`}
              >
                {text}
              </button>
            ))}
          </div>

          {mode === "search" && (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                {presets.map((p) => (
                  <button
                    key={p.query}
                    type="button"
                    onClick={() => search(p.query)}
                    className="text-xs px-2.5 py-1 rounded-badge border border-[var(--divider)] text-secondary hover:border-primary"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className={input}
                  placeholder="koto, lofi study, ambient…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && search(query)}
                />
                <button type="button" onClick={() => search(query)} disabled={busy !== null} className="btn-primary shrink-0 disabled:opacity-50">
                  Search
                </button>
              </div>
              {searchNote && <p className="text-xs text-amber-700">{searchNote}</p>}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {results.map((r) => (
                  <div key={r.externalId} className="border border-[var(--divider)] rounded-card p-3 flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="text-sm text-charcoal font-medium">{r.title}</div>
                      <div className="text-xs text-secondary">
                        {r.artist} · {Math.round(r.durationSeconds)}s · {r.license}
                      </div>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-badge border ${
                        r.commercialUse === "allowed"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : r.commercialUse === "not_allowed"
                            ? "bg-red-light border-red-200 text-primary"
                            : "bg-amber-50 border-amber-200 text-amber-700"
                      }`}
                    >
                      {r.commercialUse === "allowed" ? "commercial ok" : r.commercialUse === "not_allowed" ? "non-commercial" : "check licence"}
                    </span>
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption -- instrumental music */}
                    <audio src={r.previewUrl} controls preload="none" className="h-8 max-w-[200px]" />
                    <button
                      type="button"
                      disabled={busy !== null || !r.downloadUrl}
                      onClick={() =>
                        importTrack(
                          {
                            source: "jamendo",
                            externalId: r.externalId,
                            audioUrl: r.downloadUrl,
                            title: r.title,
                            license: r.license,
                            licenseUrl: r.licenseUrl,
                            attribution: r.artist,
                            requiresAttribution: r.requiresAttribution,
                            sourceUrl: r.sourceUrl,
                            durationSeconds: r.durationSeconds,
                            previewUrl: r.previewUrl,
                            mood: presets.find((p) => p.query === query)?.mood ?? null,
                          },
                          `import:${r.externalId}`
                        )
                      }
                      className="btn-primary text-sm disabled:opacity-50"
                    >
                      {busy === `import:${r.externalId}` ? "…" : "Import"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {mode === "url" && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={label} htmlFor="imp-url">Direct link to the audio file</label>
                  <input id="imp-url" className={input} placeholder="https://…/track.mp3" value={urlValue} onChange={(e) => setUrlValue(e.target.value)} />
                  <p className="text-xs text-secondary mt-1">
                    Link to the MP3 itself, not the page it sits on. Works for DOVA-SYNDROME and Pixabay,
                    neither of which has a music API.
                  </p>
                </div>
                <div>
                  <label className={label} htmlFor="imp-title">Title</label>
                  <input id="imp-title" className={input} value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div>
                  <label className={label} htmlFor="imp-lic">Licence</label>
                  <input id="imp-lic" className={input} placeholder="Pixabay Content Licence" value={license} onChange={(e) => setLicense(e.target.value)} />
                </div>
                <div>
                  <label className={label} htmlFor="imp-attr">Attribution</label>
                  <input id="imp-attr" className={input} value={attribution} onChange={(e) => setAttribution(e.target.value)} />
                </div>
                <div>
                  <label className={label} htmlFor="imp-mood">Mood</label>
                  <input id="imp-mood" className={input} placeholder="calm, upbeat" value={mood} onChange={(e) => setMood(e.target.value)} />
                </div>
              </div>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() =>
                  importTrack(
                    { source: "url_import", audioUrl: urlValue, title, license, attribution, mood, sourceUrl: urlValue },
                    "import:url"
                  )
                }
                className="btn-primary disabled:opacity-50"
              >
                {busy === "import:url" ? "Fetching…" : "Import from URL"}
              </button>

              {sources.filter((s) => s.integration === "manual").length > 0 && (
                <div className="border-t border-[var(--divider)] pt-4 space-y-3">
                  <p className="text-xs uppercase tracking-wider text-secondary font-semibold">Where to find tracks</p>
                  {sources.filter((s) => s.integration === "manual").map((src) => (
                    <div key={src.id} className="text-sm">
                      <a href={src.url} target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium">
                        {src.name}
                      </a>
                      <span className="text-secondary"> — {src.bestFor}</span>
                      <div className="text-xs text-secondary mt-0.5">{src.licenceSummary}</div>
                      {src.caveat && <div className="text-xs text-amber-700 mt-0.5">{src.caveat}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {mode === "upload" && (
          <form onSubmit={upload} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={label} htmlFor="bgm-file">Audio file</label>
                <input
                  id="bgm-file"
                  ref={fileRef}
                  type="file"
                  accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/flac,.mp3,.wav,.ogg,.m4a,.flac"
                  className={input}
                  required
                />
                <p className="text-xs text-secondary mt-1">MP3, WAV, OGG, M4A or FLAC. Up to 20MB.</p>
              </div>
              <div>
                <label className={label} htmlFor="bgm-title">Title</label>
                <input id="bgm-title" className={input} value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div>
                <label className={label} htmlFor="bgm-license">Licence</label>
                <input
                  id="bgm-license"
                  className={input}
                  placeholder="e.g. CC0, YouTube Audio Library, Epidemic Sound sub"
                  value={license}
                  onChange={(e) => setLicense(e.target.value)}
                  required
                />
                <p className="text-xs text-secondary mt-1">
                  Required. A claim on the wrong track applies to every video that used it.
                </p>
              </div>
              <div>
                <label className={label} htmlFor="bgm-attribution">Attribution (if the licence needs it)</label>
                <input
                  id="bgm-attribution"
                  className={input}
                  value={attribution}
                  onChange={(e) => setAttribution(e.target.value)}
                />
              </div>
              <div>
                <label className={label} htmlFor="bgm-source">Source URL</label>
                <input id="bgm-source" className={input} value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={label} htmlFor="bgm-mood">Mood</label>
                  <input id="bgm-mood" className={input} placeholder="calm, upbeat" value={mood} onChange={(e) => setMood(e.target.value)} />
                </div>
                <div>
                  <label className={label} htmlFor="bgm-gain">Gain (dB)</label>
                  <input
                    id="bgm-gain"
                    type="number"
                    min={-40}
                    max={0}
                    className={input}
                    value={gain}
                    onChange={(e) => setGain(Number(e.target.value))}
                  />
                  <p className="text-xs text-secondary mt-1">−18 sits well under speech.</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button type="submit" disabled={busy !== null} className="btn-primary disabled:opacity-50">
                {busy === "upload" ? "Uploading…" : "Add track"}
              </button>
            </div>
          </form>
          )}

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-5 text-sm px-3 py-2 rounded-button border border-[var(--divider)] text-secondary"
          >
            Close
          </button>
        </AdminCard>
      )}
    </div>
  );
}
