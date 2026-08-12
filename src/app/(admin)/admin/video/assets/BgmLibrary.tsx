"use client";

import { useRef, useState } from "react";
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

export function BgmLibrary({ initialTracks }: { initialTracks: BgmTrack[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [tracks, setTracks] = useState(initialTracks);
  const [open, setOpen] = useState(initialTracks.length === 0);
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
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm px-3 py-2 rounded-button border border-[var(--divider)] text-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </AdminCard>
      )}
    </div>
  );
}
