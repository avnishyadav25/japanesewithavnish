"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LEARN_CONTENT_TYPES } from "@/lib/learn-filters";
import { FORMAT_SPECS, NARRATION_LANG_LABELS, NARRATION_LANGS, VIDEO_FORMATS } from "@/lib/video/types";
import type { NarrationLang, ScopeKind, ScopeRef, VideoFormat } from "@/lib/video/types";

interface Props {
  themes: { key: string; label: string; description: string | null }[];
  bgmTracks: { id: string; title: string; mood: string | null }[];
  levels: { id: string; code: string; name: string | null }[];
  lessons: { id: string; title: string; code: string; level_code: string }[];
}

interface Preview {
  title: string;
  itemCount: number;
  plannedVideos: number;
  jlptLevel: string | null;
  items: { title: string; kind: string; jlptLevel: string | null; exampleCount: number }[];
}

const JLPT_LEVELS = ["N5", "N4", "N3", "N2", "N1"];

/** Only these have purpose-built scene templates today; the rest fall back to a generic
 * title-card + example layout, which is honest but not what you want for a flagship video. */
const WELL_SUPPORTED = new Set(["vocabulary", "kanji", "grammar"]);

const label = "block text-sm font-semibold text-charcoal mb-1.5";
const input =
  "w-full border border-[var(--divider)] rounded-button px-3 py-2 text-sm focus:outline-none focus:border-primary";

export function NewVideoWizard({ themes, bgmTracks, levels, lessons }: Props) {
  const router = useRouter();

  const [scopeKind, setScopeKind] = useState<ScopeKind>("content_batch");
  const [contentType, setContentType] = useState("vocabulary");
  const [jlptLevel, setJlptLevel] = useState("N5");
  const [limit, setLimit] = useState(10);
  const [levelId, setLevelId] = useState(levels[0]?.id ?? "");
  const [lessonId, setLessonId] = useState(lessons[0]?.id ?? "");

  const [grouping, setGrouping] = useState<"single_video" | "video_per_item">("single_video");
  const [formats, setFormats] = useState<VideoFormat[]>(["vertical"]);
  const [narrationLangs, setNarrationLangs] = useState<NarrationLang[]>(["en"]);
  const [themeKey, setThemeKey] = useState(themes[0]?.key ?? "washi-light");
  const [bgmTrackId, setBgmTrackId] = useState("");
  const [tone, setTone] = useState("");
  const [targetDuration, setTargetDuration] = useState<number | "">(60);
  const [title, setTitle] = useState("");
  const [includeBroll, setIncludeBroll] = useState(false);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<"preview" | "create" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function buildScopeRef(): ScopeRef {
    if (scopeKind === "content_batch") {
      return { contentType, jlptLevel: jlptLevel || undefined, limit: Number(limit) || 10 };
    }
    if (scopeKind === "curriculum_level") return { levelId };
    if (scopeKind === "curriculum_lesson") return { lessonId };
    return {};
  }

  function toggle<T>(list: T[], value: T, setter: (next: T[]) => void) {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function runPreview() {
    setBusy("preview");
    setError(null);
    setPreview(null);
    try {
      const res = await fetch("/api/admin/video/scope/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scopeKind, scopeRef: buildScopeRef(), grouping }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview failed");
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setBusy(null);
    }
  }

  async function create() {
    setBusy("create");
    setError(null);
    try {
      const res = await fetch("/api/admin/video/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || undefined,
          scopeKind,
          scopeRef: buildScopeRef(),
          grouping,
          formats,
          narrationLangs,
          themeKey,
          bgmTrackId: bgmTrackId || null,
          tone: tone.trim() || null,
          targetDurationSeconds: targetDuration === "" ? null : Number(targetDuration),
          includeBroll,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create the project");
      router.push(`/admin/video/projects/${data.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the project");
      setBusy(null);
    }
  }

  const totalRenders = (preview?.plannedVideos ?? 0) * formats.length * narrationLangs.length;

  return (
    <div className="space-y-8">
      {/* ---------------- Scope ---------------- */}
      <section>
        <h2 className="font-heading text-lg font-bold text-charcoal mb-4">1. What should the video cover?</h2>

        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          {(
            [
              ["content_batch", "A batch of items", "e.g. 10 N5 vocabulary words"],
              ["curriculum_lesson", "One lesson", "A full curriculum lesson, block by block"],
              ["curriculum_level", "A whole level", "Every lesson in N5, N4, …"],
            ] as [ScopeKind, string, string][]
          ).map(([kind, name, hint]) => (
            <button
              key={kind}
              type="button"
              onClick={() => {
                setScopeKind(kind);
                setPreview(null);
              }}
              className={`text-left border rounded-card p-3 transition ${
                scopeKind === kind ? "border-primary bg-red-light" : "border-[var(--divider)] hover:border-primary/40"
              }`}
            >
              <div className="font-semibold text-sm text-charcoal">{name}</div>
              <div className="text-xs text-secondary mt-0.5">{hint}</div>
            </button>
          ))}
        </div>

        {scopeKind === "content_batch" && (
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className={label} htmlFor="contentType">Content type</label>
              <select
                id="contentType"
                className={input}
                value={contentType}
                onChange={(e) => {
                  setContentType(e.target.value);
                  setPreview(null);
                }}
              >
                {LEARN_CONTENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, " ")}
                    {WELL_SUPPORTED.has(type) ? "" : " (generic scenes)"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="jlpt">JLPT level</label>
              <select id="jlpt" className={input} value={jlptLevel} onChange={(e) => { setJlptLevel(e.target.value); setPreview(null); }}>
                <option value="">Any</option>
                {JLPT_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="limit">How many items</label>
              <input
                id="limit"
                type="number"
                min={1}
                max={200}
                className={input}
                value={limit}
                onChange={(e) => { setLimit(Number(e.target.value)); setPreview(null); }}
              />
            </div>
          </div>
        )}

        {scopeKind === "curriculum_level" && (
          <div>
            <label className={label} htmlFor="level">Level</label>
            <select id="level" className={input} value={levelId} onChange={(e) => { setLevelId(e.target.value); setPreview(null); }}>
              {levels.map((lvl) => (
                <option key={lvl.id} value={lvl.id}>{lvl.code}{lvl.name ? ` — ${lvl.name}` : ""}</option>
              ))}
            </select>
          </div>
        )}

        {scopeKind === "curriculum_lesson" && (
          <div>
            <label className={label} htmlFor="lesson">Lesson</label>
            <select id="lesson" className={input} value={lessonId} onChange={(e) => { setLessonId(e.target.value); setPreview(null); }}>
              {lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>{lesson.level_code} · {lesson.code} — {lesson.title}</option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={runPreview} disabled={busy !== null} className="btn-primary disabled:opacity-50">
            {busy === "preview" ? "Checking…" : "Preview what this covers"}
          </button>
          {preview && (
            <span className="text-sm text-secondary">
              {preview.itemCount} item{preview.itemCount === 1 ? "" : "s"} — &ldquo;{preview.title}&rdquo;
            </span>
          )}
        </div>

        {preview && (
          <div className="mt-3 border border-[var(--divider)] rounded-card p-3 max-h-52 overflow-y-auto">
            <ul className="text-sm text-secondary space-y-1">
              {preview.items.map((item, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="text-charcoal">{item.title}</span>
                  <span className="text-xs shrink-0">
                    {item.jlptLevel ?? "—"} · {item.exampleCount} example{item.exampleCount === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
              {preview.itemCount > preview.items.length && (
                <li className="text-xs italic">…and {preview.itemCount - preview.items.length} more</li>
              )}
            </ul>
          </div>
        )}
      </section>

      {/* ---------------- Output ---------------- */}
      <section>
        <h2 className="font-heading text-lg font-bold text-charcoal mb-4">2. What should it produce?</h2>

        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <span className={label}>Grouping</span>
            <div className="space-y-2">
              {(
                [
                  ["single_video", "One video covering everything"],
                  ["video_per_item", "A separate video per item"],
                ] as ["single_video" | "video_per_item", string][]
              ).map(([value, text]) => (
                <label key={value} className="flex items-center gap-2 text-sm text-charcoal">
                  <input type="radio" name="grouping" checked={grouping === value} onChange={() => setGrouping(value)} />
                  {text}
                </label>
              ))}
            </div>
          </div>

          <div>
            <span className={label}>Formats</span>
            <div className="space-y-2">
              {VIDEO_FORMATS.map((format) => (
                <label key={format} className="flex items-center gap-2 text-sm text-charcoal">
                  <input type="checkbox" checked={formats.includes(format)} onChange={() => toggle(formats, format, setFormats)} />
                  {FORMAT_SPECS[format].label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <span className={label}>Narration</span>
            <div className="space-y-2">
              {NARRATION_LANGS.map((lang) => (
                <label key={lang} className="flex items-center gap-2 text-sm text-charcoal">
                  <input
                    type="checkbox"
                    checked={narrationLangs.includes(lang)}
                    onChange={() => toggle(narrationLangs, lang, setNarrationLangs)}
                  />
                  {NARRATION_LANG_LABELS[lang]}
                </label>
              ))}
            </div>
            <p className="text-xs text-secondary mt-2">
              Japanese words and sentences are always spoken by a native ja-JP voice, whichever narration language you
              pick.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className={label} htmlFor="theme">Theme</label>
              <select id="theme" className={input} value={themeKey} onChange={(e) => setThemeKey(e.target.value)}>
                {themes.map((theme) => (
                  <option key={theme.key} value={theme.key}>{theme.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="bgm">Background music</label>
              <select id="bgm" className={input} value={bgmTrackId} onChange={(e) => setBgmTrackId(e.target.value)}>
                <option value="">None</option>
                {bgmTracks.map((track) => (
                  <option key={track.id} value={track.id}>{track.title}{track.mood ? ` — ${track.mood}` : ""}</option>
                ))}
              </select>
              {bgmTracks.length === 0 && (
                <p className="text-xs text-secondary mt-1">No tracks in the library yet.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Voice ---------------- */}
      <section>
        <h2 className="font-heading text-lg font-bold text-charcoal mb-4">3. How should it sound?</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className={label} htmlFor="tone">Tone (optional)</label>
            <input
              id="tone"
              className={input}
              placeholder="e.g. warm and encouraging, for absolute beginners"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
            />
          </div>
          <div>
            <label className={label} htmlFor="duration">Target length (seconds)</label>
            <input
              id="duration"
              type="number"
              min={15}
              max={1800}
              className={input}
              value={targetDuration}
              onChange={(e) => setTargetDuration(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </div>
        </div>
        <div className="mt-4">
          <label className={label} htmlFor="title">Project title (optional)</label>
          <input
            id="title"
            className={input}
            placeholder={preview?.title ?? "Defaults to the scope name"}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <label className="flex items-start gap-2 mt-4 text-sm text-charcoal">
          <input
            type="checkbox"
            checked={includeBroll}
            onChange={(e) => setIncludeBroll(e.target.checked)}
            className="mt-1"
          />
          <span>
            Include a real-page shot from the live site
            <span className="block text-xs text-secondary">
              Adds a scene that scrolls the actual page this content came from. Costs a browser
              capture per video — worth it on longer formats and marketing clips, usually skipped
              on a 60-second short.
            </span>
          </span>
        </label>
      </section>

      {/* ---------------- Commit ---------------- */}
      <section className="border-t border-[var(--divider)] pt-6">
        {preview && (
          <p className="text-sm text-secondary mb-3">
            This will produce <strong className="text-charcoal">{preview.plannedVideos}</strong> video
            {preview.plannedVideos === 1 ? "" : "s"} and queue{" "}
            <strong className="text-charcoal">{totalRenders}</strong> render
            {totalRenders === 1 ? "" : "s"} ({formats.length} format{formats.length === 1 ? "" : "s"} ×{" "}
            {narrationLangs.length} language{narrationLangs.length === 1 ? "" : "s"}).
            {totalRenders > 20 && " That is a lot of render minutes — consider narrowing the scope first."}
          </p>
        )}
        {error && <p className="text-sm text-primary mb-3">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={create}
            disabled={busy !== null || formats.length === 0 || narrationLangs.length === 0}
            className="btn-primary disabled:opacity-50"
          >
            {busy === "create" ? "Creating…" : "Create project"}
          </button>
          <span className="text-xs text-secondary">
            Nothing renders yet — the next step generates a script for you to review.
          </span>
        </div>
      </section>
    </div>
  );
}
