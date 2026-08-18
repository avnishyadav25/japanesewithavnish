"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LEARN_CONTENT_TYPES } from "@/lib/learn-filters";
import { FORMAT_SPECS, NARRATION_LANG_LABELS, NARRATION_LANGS, VIDEO_FORMATS, stylePresetForFormats } from "@/lib/video/types";
import type { NarrationLang, PacingConfig, ScopeKind, ScopeRef, VideoFormat, VoiceConfig } from "@/lib/video/types";
import { formatDuration } from "@/lib/video/pacing";
import { VOICE_CATALOGUE } from "@/lib/video/voices";
import { EstimatePanel, type ScopeEstimate } from "./EstimatePanel";
import { MAX_SPLIT_ITEMS, SPLIT_WARN_ITEMS } from "@/lib/video/splitScope";
import { ItemPicker, type PickerItem } from "./ItemPicker";

interface Props {
  themes: { key: string; label: string; description: string | null }[];
  bgmTracks: { id: string; title: string; mood: string | null }[];
  levels: { id: string; code: string; name: string | null }[];
  lessons: { id: string; title: string; code: string; level_code: string }[];
  /** Query-string defaults from the content plan's deep links. Validated here, not trusted. */
  initial?: { scopeKind?: string; contentType?: string; jlptLevel?: string; topic?: string };
}

const JLPT_LEVELS = ["N5", "N4", "N3", "N2", "N1"];

/** Scope kinds this wizard can drive. The API accepts more (content_item, module, submodule);
 * those are reachable only programmatically. */
const WIZARD_SCOPE_KINDS: ScopeKind[] = ["content_batch", "curriculum_lesson", "curriculum_level", "topic"];

/** These have bespoke scene templates; the rest fall back to a generic title-card layout, which
 * is honest but not what you want for a flagship video. */
const WELL_SUPPORTED = new Set(["vocabulary", "kanji", "grammar"]);

const STEPS = ["Content", "Output", "Pacing & voice", "Review"] as const;

const label = "block text-sm font-semibold text-charcoal mb-1.5";
const input =
  "w-full border border-[var(--divider)] rounded-button px-3 py-2 text-sm focus:outline-none focus:border-primary";

/**
 * Parse a response body that MIGHT not be JSON.
 *
 * `res.json()` on a 500 throws "Failed to execute 'json' on 'Response': Unexpected end of JSON
 * input", which is what the wizard showed the user when createProject failed on a parameter
 * mismatch. That message describes the parser, not the problem — it is the same string for a
 * crashed route, a proxy timeout and an empty body, and it sent me looking at the client when the
 * fault was a SQL statement.
 *
 * Returns the server's own error when there is one, and the status line when there is not.
 *
 * Typed as `any` to match what `res.json()` already returned, so this is a drop-in replacement at
 * every call site rather than a typing change disguised as a bug fix.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(`The server returned ${res.status} ${res.statusText} with an empty body. Check the dev server log.`);
  }
  try {
    return JSON.parse(text);
  } catch {
    // An HTML error page, most often. Show the first readable line rather than the markup.
    const plain = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    throw new Error(`The server returned ${res.status} instead of JSON: ${plain.slice(0, 200) || "(unreadable body)"}`);
  }
}

export function NewVideoWizard({ themes, bgmTracks, levels, lessons, initial }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // --- step 1: content ---
  // Deep-link defaults are validated against the known lists rather than used raw: these arrive
  // from a URL, and an unrecognised contentType would put the select into a blank state whose
  // estimate call then fails with a server error instead of a visible wrong choice.
  const [scopeKind, setScopeKind] = useState<ScopeKind>(
    WIZARD_SCOPE_KINDS.includes(initial?.scopeKind as ScopeKind)
      ? (initial!.scopeKind as ScopeKind)
      : initial?.topic
        ? "topic"
        : "content_batch"
  );
  const [contentType, setContentType] = useState(
    LEARN_CONTENT_TYPES.includes(initial?.contentType as (typeof LEARN_CONTENT_TYPES)[number])
      ? initial!.contentType!
      : "vocabulary"
  );
  const [jlptLevel, setJlptLevel] = useState(
    JLPT_LEVELS.includes(initial?.jlptLevel ?? "") ? initial!.jlptLevel! : "N5"
  );
  const [limit, setLimit] = useState(10);
  const [levelId, setLevelId] = useState(levels[0]?.id ?? "");
  const [lessonId, setLessonId] = useState(lessons[0]?.id ?? "");
  const [topic, setTopic] = useState(initial?.topic ?? "");

  /**
   * The confirmed item basket, or null for "whatever the filters pick".
   *
   * null and [] mean different things and the difference matters: null leaves the scope as a
   * query (contentType + level + limit) exactly as before, while [] is an explicit empty
   * selection that must not silently fall back to picking ten items you did not choose.
   */
  const [selectedPostIds, setSelectedPostIds] = useState<string[] | null>(null);

  /** Everything on offer in the picker, and which of it is ticked. */
  const [pickerItems, setPickerItems] = useState<PickerItem[]>([]);
  const [pickerSelected, setPickerSelected] = useState<string[]>([]);
  const [topicBusy, setTopicBusy] = useState(false);
  const [topicNotice, setTopicNotice] = useState<string | null>(null);

  // --- step 2: output ---
  const [grouping, setGrouping] = useState<"single_video" | "video_per_item">("single_video");
  const [formats, setFormats] = useState<VideoFormat[]>(["vertical"]);
  const [narrationLangs, setNarrationLangs] = useState<NarrationLang[]>(["en"]);
  const [themeKey, setThemeKey] = useState(themes[0]?.key ?? "washi-light");
  const [bgmTrackId, setBgmTrackId] = useState("");
  const [includeBroll, setIncludeBroll] = useState(false);

  // --- step 3: pacing & voice ---
  const [pacing, setPacing] = useState<PacingConfig | null>(null);
  const [voices, setVoices] = useState<VoiceConfig>({});
  const [tone, setTone] = useState("");
  const [title, setTitle] = useState("");
  const [sampling, setSampling] = useState<string | null>(null);
  const sampleAudio = useRef<HTMLAudioElement | null>(null);

  const [estimate, setEstimate] = useState<ScopeEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  /**
   * How many projects a split would create, and how long their renders would take.
   *
   * Derived from the estimate rather than guessed, so the number on screen is the number the
   * server will produce. Render time uses the measured ~1.4x realtime and the fact that renders
   * are serialised by the workflow's concurrency group.
   */
  const splitCount = estimate?.itemCount ?? 0;
  const splitRenderMinutes = useMemo(() => {
    if (!estimate) return 0;
    const perVideo = estimate.estimate.perVideoSeconds * 1.4;
    return Math.max(1, Math.round((perVideo * splitCount * formats.length * narrationLangs.length) / 60));
  }, [estimate, splitCount, formats.length, narrationLangs.length]);

  const scopeRef: ScopeRef = useMemo(() => {
    if (scopeKind === "topic") return { topic: topic.trim(), postIds: selectedPostIds ?? [] };
    if (scopeKind === "content_batch") {
      return {
        contentType,
        jlptLevel: jlptLevel || undefined,
        limit: Number(limit) || 10,
        // Only sent once you have touched the picker. Absent means "use the filters", which is
        // the behaviour every existing project was created with.
        ...(selectedPostIds ? { postIds: selectedPostIds } : {}),
      };
    }
    if (scopeKind === "curriculum_level") return { levelId };
    if (scopeKind === "curriculum_lesson") return { lessonId };
    return {};
  }, [scopeKind, contentType, jlptLevel, limit, levelId, lessonId, topic, selectedPostIds]);

  // A filter change invalidates a basket picked under the old filters — otherwise switching from
  // N5 to N4 keeps ten N5 ids selected and the level dropdown quietly does nothing.
  useEffect(() => {
    setSelectedPostIds(null);
  }, [contentType, jlptLevel, limit, scopeKind]);


  /**
   * Seeds the picker from whatever the filters resolved.
   *
   * Only for query-driven scopes. A topic's list is built by resolveTopic() and must not be
   * overwritten when the estimate comes back for the ids it just chose.
   */
  useEffect(() => {
    if (scopeKind === "topic") return;
    if (!estimate) {
      setPickerItems([]);
      setPickerSelected([]);
      return;
    }
    // Only when the user has not curated yet — re-seeding on every estimate would undo a
    // deselection the moment the estimate refreshed in response to it.
    if (selectedPostIds !== null) return;
    const items: PickerItem[] = estimate.items
      .filter((i) => i.postId)
      .map((i) => ({
        postId: i.postId!,
        contentType: i.kind,
        title: i.title,
        jlptLevel: i.jlptLevel ?? undefined,
        url: i.url ?? undefined,
        source: "library" as const,
      }));
    setPickerItems(items);
    setPickerSelected(items.map((i) => i.postId!));
  }, [estimate, scopeKind, selectedPostIds]);

  /** Ticked ids flow back into the scope, which re-prices the estimate. */
  useEffect(() => {
    if (pickerItems.length === 0) return;
    const ids = pickerSelected.filter((k) => !k.startsWith("llm:"));
    const everything = pickerItems.every((i) => pickerSelected.includes(i.postId ?? `llm:${i.word ?? i.title}`));
    // Untouched means "leave the scope as a query", which is how every existing project was made.
    if (everything && scopeKind !== "topic") return;
    setSelectedPostIds(ids);
  }, [pickerSelected, pickerItems, scopeKind]);

  /** Topic -> expanded terms -> library matches + newly written words. Saves nothing. */
  async function resolveTopic() {
    if (!topic.trim()) return;
    setTopicBusy(true);
    setTopicNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/video/topics/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, jlptLevel: jlptLevel || undefined, count: limit }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error ?? "Could not resolve that topic");

      const items: PickerItem[] = [...(data.library ?? []), ...(data.proposed ?? [])];
      setPickerItems(items);
      setPickerSelected(items.map((i) => i.postId ?? `llm:${i.word ?? i.title}`));
      setTopicNotice(
        data.notice ??
          `${data.library?.length ?? 0} from your library` +
            ((data.proposed?.length ?? 0) > 0 ? `, ${data.proposed.length} newly written` : "") +
            ` · matched on: ${(data.terms ?? []).slice(0, 8).join(", ")}`
      );
      if (data.llmError) setError(`Library search worked; writing new words failed: ${data.llmError}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resolve that topic");
    } finally {
      setTopicBusy(false);
    }
  }

  function addPickerItem(item: PickerItem) {
    const key = item.postId ?? `llm:${item.word ?? item.title}`;
    setPickerItems((prev) => (prev.some((i) => (i.postId ?? `llm:${i.word ?? i.title}`) === key) ? prev : [...prev, item]));
    setPickerSelected((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }

  /**
   * Re-prices on every change, debounced.
   *
   * Deliberately automatic rather than behind a "Preview" button: the whole point is that you
   * see the cost of a choice as you make it, not after committing to it.
   */
  const refreshEstimate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/video/scope/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scopeKind, scopeRef, grouping, formats, narrationLangs, pacing, voices }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "Could not resolve that scope");
      setEstimate(data);
      // Adopt the per-content-type defaults the first time a scope resolves, so step 3 opens on
      // something sensible rather than on a generic 12 seconds.
      if (!pacing && data.pacing) setPacing(data.pacing);
    } catch (err) {
      setEstimate(null);
      setError(err instanceof Error ? err.message : "Could not resolve that scope");
    } finally {
      setLoading(false);
    }
  }, [scopeKind, scopeRef, grouping, formats, narrationLangs, pacing, voices]);

  useEffect(() => {
    const timer = setTimeout(() => void refreshEstimate(), 350);
    return () => clearTimeout(timer);
  }, [refreshEstimate]);

  function toggle<T>(list: T[], value: T, setter: (next: T[]) => void) {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  function setPacingField<K extends keyof PacingConfig>(key: K, value: PacingConfig[K]) {
    setPacing((current) => (current ? { ...current, [key]: value } : current));
  }

  async function playSample(lang: NarrationLang, voice: string) {
    setSampling(voice);
    setError(null);
    try {
      const rate = lang === "ja" ? pacing?.japaneseRate ?? 0.85 : pacing?.narrationRate ?? 1;
      const res = await fetch("/api/admin/video/voices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, voice, rate }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "Could not synthesise a sample");
      sampleAudio.current?.pause();
      sampleAudio.current = new Audio(data.url);
      await sampleAudio.current.play();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not play a sample");
    } finally {
      setSampling(null);
    }
  }

  async function create() {
    setCreating(true);
    setError(null);
    try {
      // LLM-written words become draft posts FIRST, because a topic scope resolves through
      // postIds and a word with no post cannot be in one. Committing here rather than at search
      // time means only the words you actually kept are written — searching four topics and
      // using one does not leave three topics' worth of drafts behind.
      let effectivePostIds = selectedPostIds;
      if (scopeKind === "topic") {
        const keptProposals = pickerItems
          .filter((i) => !i.postId && pickerSelected.includes(`llm:${i.word ?? i.title}`))
          .map((i) => i.proposal)
          .filter(Boolean);

        const libraryIds = pickerSelected.filter((k) => !k.startsWith("llm:"));
        if (keptProposals.length > 0) {
          const res = await fetch("/api/admin/video/topics/commit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topic, words: keptProposals }),
          });
          const data = await readJson(res);
          if (!res.ok) throw new Error(data.error ?? "Could not save the new words");
          effectivePostIds = [...libraryIds, ...(data.postIds ?? [])];
        } else {
          effectivePostIds = libraryIds;
        }

        if (effectivePostIds.length === 0) {
          throw new Error("Pick at least one item for this topic.");
        }
      }

      const res = await fetch("/api/admin/video/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || undefined,
          scopeKind,
          scopeRef: scopeKind === "topic" ? { topic: topic.trim(), postIds: effectivePostIds ?? [] } : scopeRef,
          grouping,
          formats,
          narrationLangs,
          themeKey,
          bgmTrackId: bgmTrackId || null,
          tone: tone.trim() || null,
          includeBroll,
          pacing,
          voices,
        }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "Could not create the project");

      // A split lands on the batch, not on one of its ten children — the useful next action is
      // "generate all of these", which is a property of the set.
      if (data.batchId) {
        router.push(`/admin/video/projects?batch=${data.batchId}`);
        return;
      }
      router.push(`/admin/video/projects/${data.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the project");
      setCreating(false);
    }
  }

  const canAdvance = step === 0 ? Boolean(estimate) : step === 1 ? formats.length > 0 && narrationLangs.length > 0 : true;

  return (
    <div className="grid lg:grid-cols-[1fr_minmax(0,300px)] gap-8 items-start">
      <div>
        {/* ---- stepper ---- */}
        <ol className="flex items-center gap-2 mb-8 flex-wrap">
          {STEPS.map((name, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li key={name} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => i <= step && setStep(i)}
                  disabled={i > step}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-button text-sm transition ${
                    active
                      ? "bg-primary text-white font-semibold"
                      : done
                        ? "text-primary hover:bg-red-light"
                        : "text-subtle cursor-default"
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full text-xs flex items-center justify-center ${
                      active ? "bg-white/25" : done ? "bg-primary text-white" : "bg-[var(--divider)]"
                    }`}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  {name}
                </button>
                {i < STEPS.length - 1 && <span className="text-subtle">›</span>}
              </li>
            );
          })}
        </ol>

        {error && <div className="mb-5 rounded-card px-4 py-3 text-sm border bg-red-light border-red-200 text-primary">{error}</div>}

        {/* ---- step 1 ---- */}
        {step === 0 && (
          <section className="space-y-5">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {(
                [
                  ["content_batch", "A batch of items", "e.g. 10 N5 vocabulary words"],
                  ["topic", "A topic", "e.g. birds, numbers, family"],
                  ["curriculum_lesson", "One lesson", "A full curriculum lesson, block by block"],
                  ["curriculum_level", "A whole level", "Every lesson in N5, N4, …"],
                ] as [ScopeKind, string, string][]
              ).map(([kind, name, hint]) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setScopeKind(kind)}
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
                  <select id="contentType" className={input} value={contentType} onChange={(e) => { setContentType(e.target.value); setPacing(null); }}>
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
                  <select id="jlpt" className={input} value={jlptLevel} onChange={(e) => setJlptLevel(e.target.value)}>
                    <option value="">Any</option>
                    {JLPT_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className={label} htmlFor="limit">How many items</label>
                  <input id="limit" type="number" min={1} max={200} className={input} value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
                </div>
              </div>
            )}

            {scopeKind === "curriculum_level" && (
              <div>
                <label className={label} htmlFor="level">Level</label>
                <select id="level" className={input} value={levelId} onChange={(e) => setLevelId(e.target.value)}>
                  {levels.map((l) => <option key={l.id} value={l.id}>{l.code}{l.name ? ` — ${l.name}` : ""}</option>)}
                </select>
              </div>
            )}

            {scopeKind === "curriculum_lesson" && (
              <div>
                <label className={label} htmlFor="lesson">Lesson</label>
                <select id="lesson" className={input} value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
                  {lessons.map((l) => <option key={l.id} value={l.id}>{l.level_code} · {l.code} — {l.title}</option>)}
                </select>
              </div>
            )}

            {scopeKind === "topic" && (
              <div className="space-y-3">
                <div className="grid sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
                  <div>
                    <label className={label} htmlFor="topic">Topic</label>
                    <input
                      id="topic"
                      type="text"
                      className={input}
                      value={topic}
                      placeholder="birds in Japanese"
                      onChange={(e) => setTopic(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), resolveTopic())}
                    />
                  </div>
                  <div>
                    <label className={label} htmlFor="topicLevel">Level</label>
                    <select id="topicLevel" className={input} value={jlptLevel} onChange={(e) => setJlptLevel(e.target.value)}>
                      <option value="">Any</option>
                      {JLPT_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={resolveTopic}
                    disabled={!topic.trim() || topicBusy}
                    className="btn-primary text-sm disabled:opacity-50 h-[38px]"
                  >
                    {topicBusy ? "Looking…" : "Find items"}
                  </button>
                </div>

                {topicNotice && <p className="text-xs text-secondary">{topicNotice}</p>}

                {/* Said plainly rather than hidden: the model's Japanese has been read by nobody,
                    and a wrong reading burned into a video is the failure worth preventing. */}
                {pickerItems.some((i) => i.source === "llm") && (
                  <p className="text-xs text-amber-700">
                    Items marked <strong>unreviewed</strong> were written just now. Keeping them saves each
                    one as a draft post so it goes through Content Review — check them before publishing
                    the pages.
                  </p>
                )}
              </div>
            )}

            {/* One picker for both scopes. A batch arrives pre-ticked with exactly what the query
                chose, so leaving it alone behaves as it always did. */}
            {pickerItems.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-secondary mb-2">
                  Items in this video{estimate ? ` — “${estimate.title}”` : ""}
                </div>
                <ItemPicker
                  items={pickerItems}
                  selectedIds={pickerSelected}
                  onChange={setPickerSelected}
                  onAdd={addPickerItem}
                  onRemoveProposed={(key) => {
                    setPickerItems((prev) => prev.filter((i) => (i.postId ?? `llm:${i.word ?? i.title}`) !== key));
                    setPickerSelected((prev) => prev.filter((k) => k !== key));
                  }}
                  contentType={scopeKind === "content_batch" ? contentType : undefined}
                  jlptLevel={jlptLevel || undefined}
                  busy={topicBusy}
                />
              </div>
            )}
          </section>
        )}

        {/* ---- step 2 ---- */}
        {step === 1 && (
          <section className="grid sm:grid-cols-2 gap-6">
            <div>
              <span className={label}>Grouping</span>
              <div className="space-y-2">
                {(
                  [
                    ["single_video", "One video covering everything"],
                    ["video_per_item", "A separate video per item"],
                  ] as const
                ).map(([value, text]) => (
                  <label key={value} className="flex items-center gap-2 text-sm text-charcoal">
                    <input type="radio" name="grouping" checked={grouping === value} onChange={() => setGrouping(value)} />
                    {text}
                  </label>
                ))}
              </div>

              {/* Splitting creates one project per item, each with its own script and render. The
                  numbers are shown because they are what makes the choice, and because this option
                  used to promise N videos and quietly make one. */}
              {grouping === "video_per_item" && splitCount > 0 && (
                <div className="mt-3 text-xs space-y-1">
                  <p className="text-secondary">
                    Creates <strong className="text-charcoal">{splitCount} separate projects</strong>, one per item,
                    each with its own script, render and social post. Good for daily Shorts.
                  </p>
                  {splitCount > MAX_SPLIT_ITEMS ? (
                    <p className="text-primary">
                      Too many to split — the limit is {MAX_SPLIT_ITEMS}. Reduce the item count, or choose one
                      video covering everything.
                    </p>
                  ) : (
                    splitCount > SPLIT_WARN_ITEMS && (
                      <p className="text-amber-700">
                        {splitCount * formats.length * narrationLangs.length} renders, and renders run one at a
                        time — roughly {splitRenderMinutes} minutes of queue.
                      </p>
                    )
                  )}
                </div>
              )}
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

              {/* Which register these formats produce.
                  The preset is DERIVED from the formats rather than chosen, so without this the
                  most consequential decision in the wizard is invisible — you would pick formats
                  and silently get either a fast Reel or a calm lesson with nothing saying which. */}
              <div
                className={`mt-3 rounded-lg border p-3 text-xs leading-relaxed ${
                  stylePresetForFormats(formats) === "shorts"
                    ? "border-sakura/40 bg-sakura/5 text-charcoal"
                    : "border-stone-200 bg-stone-50 text-charcoal/80"
                }`}
              >
                {stylePresetForFormats(formats) === "shorts" ? (
                  <>
                    <strong>Shorts pacing.</strong> Each item is split into 2–3 short beats, the camera
                    keeps moving, captions highlight each word as it is spoken, and the hook is spoken
                    over the first second. Roughly 45% shorter than a lesson.
                  </>
                ) : (
                  <>
                    <strong>Lesson pacing.</strong> One card per item, held for as long as the narration
                    takes. <em>Vertical on its own</em> switches to Shorts pacing — adding any other
                    format keeps lesson pacing, so a YouTube cut is never chopped into beats.
                  </>
                )}
              </div>
            </div>

            <div>
              <span className={label}>Narration</span>
              <div className="space-y-2">
                {NARRATION_LANGS.map((lang) => (
                  <label key={lang} className="flex items-center gap-2 text-sm text-charcoal">
                    <input type="checkbox" checked={narrationLangs.includes(lang)} onChange={() => toggle(narrationLangs, lang, setNarrationLangs)} />
                    {NARRATION_LANG_LABELS[lang]}
                  </label>
                ))}
              </div>
              <p className="text-xs text-secondary mt-2">
                Japanese words are always spoken by a native ja-JP voice whichever you pick. Each extra
                language is a separate script and a separate render.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className={label} htmlFor="theme">Theme</label>
                <select id="theme" className={input} value={themeKey} onChange={(e) => setThemeKey(e.target.value)}>
                  {themes.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="bgm">Background music</label>
                <select id="bgm" className={input} value={bgmTrackId} onChange={(e) => setBgmTrackId(e.target.value)}>
                  <option value="">None — silent under the narration</option>
                  {bgmTracks.map((t) => <option key={t.id} value={t.id}>{t.title}{t.mood ? ` — ${t.mood}` : ""}</option>)}
                </select>
                <p className="text-xs text-secondary mt-1">
                  {bgmTracks.length === 0
                    ? "No tracks yet — add some under Music & Assets."
                    : "Leave as None for Reels/TikTok if you plan to add a trending sound in-app."}
                </p>
              </div>
            </div>

            <label className="sm:col-span-2 flex items-start gap-2 text-sm text-charcoal">
              <input type="checkbox" checked={includeBroll} onChange={(e) => setIncludeBroll(e.target.checked)} className="mt-1" />
              <span>
                Include a real-page shot from the live site
                <span className="block text-xs text-secondary">
                  Adds a scene scrolling the actual page. Costs a browser capture — worth it on long-form
                  and marketing clips, usually skipped on a short.
                </span>
              </span>
            </label>
          </section>
        )}

        {/* ---- step 3 ---- */}
        {step === 2 && pacing && (
          <section className="space-y-6">
            <div>
              <h3 className="font-heading font-bold text-charcoal mb-1">Pacing</h3>
              <p className="text-sm text-secondary mb-4">
                Seconds per item drives everything — the narration word budget is computed from it, so
                unlike the old “target length” it actually binds.
                {estimate && estimate.achievedSecondsPerItem > pacing.secondsPerItem * 1.25 && (
                  <span className="block text-amber-700 mt-1">
                    This actually works out at ~{estimate.achievedSecondsPerItem}s per item — the Japanese audio,
                    repeats and pauses already fill the budget. Raise it, or cut a repeat or the pause.
                  </span>
                )}
              </p>

              <div className="space-y-4">
                <Slider
                  id="spi" label="Seconds per item" min={5} max={90} step={1}
                  value={pacing.secondsPerItem} onChange={(v) => setPacingField("secondsPerItem", v)}
                  display={`${pacing.secondsPerItem}s`}
                />
                <div>
                  <span className={label}>Repeat the Japanese</span>
                  <div className="flex gap-3">
                    {([1, 2, 3] as const).map((n) => (
                      <label key={n} className="flex items-center gap-1.5 text-sm text-charcoal">
                        <input type="radio" name="repeat" checked={pacing.repeatJapanese === n} onChange={() => setPacingField("repeatJapanese", n)} />
                        {n}×
                      </label>
                    ))}
                  </div>
                </div>
                <Slider
                  id="pause" label="Pause for the learner to repeat" min={0} max={4} step={0.1}
                  value={pacing.pauseAfterJapaneseSeconds} onChange={(v) => setPacingField("pauseAfterJapaneseSeconds", v)}
                  display={pacing.pauseAfterJapaneseSeconds === 0 ? "off" : `${pacing.pauseAfterJapaneseSeconds.toFixed(1)}s`}
                  hint="Silence after each Japanese phrase — this is shadowing practice, not padding."
                />
                <Slider
                  id="jarate" label="Japanese speaking rate" min={0.6} max={1.1} step={0.05}
                  value={pacing.japaneseRate} onChange={(v) => setPacingField("japaneseRate", v)}
                  display={`${pacing.japaneseRate.toFixed(2)}×`}
                />
                <Slider
                  id="enrate" label="Narration speaking rate" min={0.8} max={1.3} step={0.05}
                  value={pacing.narrationRate} onChange={(v) => setPacingField("narrationRate", v)}
                  display={`${pacing.narrationRate.toFixed(2)}×`}
                />
              </div>
            </div>

            <div className="border-t border-[var(--divider)] pt-5">
              <h3 className="font-heading font-bold text-charcoal mb-3">Voices</h3>
              <div className="space-y-4">
                {/* Japanese always appears: even an English-narrated video speaks its Japanese
                    terms with a native voice, so that voice is always a real choice. */}
                {NARRATION_LANGS.filter((l) => narrationLangs.includes(l) || l === "ja").map((lang) => (
                  <div key={lang}>
                    <label className={label} htmlFor={`voice-${lang}`}>
                      {lang === "ja" ? "Japanese words and sentences" : NARRATION_LANG_LABELS[lang]}
                    </label>
                    <div className="flex gap-2">
                      <select
                        id={`voice-${lang}`}
                        className={input}
                        value={voices[lang] ?? VOICE_CATALOGUE[lang][0].name}
                        onChange={(e) => setVoices((v) => ({ ...v, [lang]: e.target.value }))}
                      >
                        {VOICE_CATALOGUE[lang].map((v) => (
                          <option key={v.name} value={v.name}>
                            {v.label} · {v.tier}{v.note ? ` — ${v.note}` : ""}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => playSample(lang, voices[lang] ?? VOICE_CATALOGUE[lang][0].name)}
                        disabled={sampling !== null}
                        className="shrink-0 px-3 rounded-button border border-[var(--divider)] text-secondary hover:border-primary disabled:opacity-50"
                        aria-label={`Play a ${lang} sample`}
                      >
                        {sampling === (voices[lang] ?? VOICE_CATALOGUE[lang][0].name) ? "…" : "▶"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-[var(--divider)] pt-5 grid sm:grid-cols-2 gap-4">
              <div>
                <label className={label} htmlFor="tone">Tone (optional)</label>
                <input id="tone" className={input} placeholder="warm and encouraging, for absolute beginners" value={tone} onChange={(e) => setTone(e.target.value)} />
              </div>
              <div>
                <label className={label} htmlFor="title">Project title (optional)</label>
                <input id="title" className={input} placeholder={estimate?.title ?? "Defaults to the scope name"} value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
            </div>
          </section>
        )}

        {/* ---- step 4 ---- */}
        {step === 3 && estimate && pacing && (
          <section className="space-y-4">
            <div className="card-content">
              <h3 className="font-heading text-lg font-bold text-charcoal mb-3">{title.trim() || estimate.title}</h3>
              <p className="text-sm text-secondary leading-relaxed">
                {grouping === "single_video"
                  ? "One video"
                  : `${splitCount} separate projects, one video each,`}{" "}
                covering{" "}
                <strong className="text-charcoal">{estimate.itemCount} {estimate.contentKind ?? "item"}
                {estimate.itemCount === 1 ? "" : "s"}</strong>
                {estimate.jlptLevel ? ` at ${estimate.jlptLevel}` : ""}, about{" "}
                <strong className="text-charcoal">{estimate.estimate.perVideoReadable}</strong> each, at{" "}
                {pacing.secondsPerItem}s per item with the Japanese spoken {pacing.repeatJapanese}× and a{" "}
                {pacing.pauseAfterJapaneseSeconds.toFixed(1)}s gap to repeat it back.
              </p>
              <p className="text-sm text-secondary leading-relaxed mt-3">
                Rendering to {formats.map((f) => FORMAT_SPECS[f].label.split(" ")[0]).join(", ")} in{" "}
                {narrationLangs.length === 1 ? NARRATION_LANG_LABELS[narrationLangs[0]].toLowerCase() : `${narrationLangs.length} languages`} —{" "}
                <strong className="text-charcoal">{estimate.plannedRenders} render{estimate.plannedRenders === 1 ? "" : "s"}</strong>,{" "}
                {formatDuration(estimate.estimate.totalSeconds)} of footage,{" "}
                {estimate.estimate.ttsCostUsd < 0.01 ? "under a cent" : `about $${estimate.estimate.ttsCostUsd.toFixed(2)}`} of voiceover.
              </p>
              {bgmTrackId === "" && formats.includes("vertical") && (
                <p className="text-xs text-secondary mt-3 border-t border-[var(--divider)] pt-3">
                  No music bed, captions burned in — the right shape for adding a trending sound inside
                  Instagram or TikTok after upload.
                </p>
              )}
            </div>

            {estimate.warnings.length > 0 && (
              <div className="card-content border-l-4 border-amber-400">
                <p className="text-sm font-semibold text-charcoal mb-2">Worth knowing first</p>
                <ul className="space-y-1.5">
                  {estimate.warnings.map((w, i) => (
                    <li key={i} className="text-sm text-secondary">{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-sm text-secondary">
              Creating the project writes nothing but the settings. The next step generates a script for you
              to read before anything renders.
            </p>
          </section>
        )}

        {/* ---- nav ---- */}
        <div className="flex items-center gap-3 mt-8 pt-6 border-t border-[var(--divider)]">
          {step > 0 && (
            <button type="button" onClick={() => setStep(step - 1)} className="text-sm px-4 py-2 rounded-button border border-[var(--divider)] text-secondary">
              ← Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={() => setStep(step + 1)} disabled={!canAdvance} className="btn-primary disabled:opacity-40">
              Next →
            </button>
          ) : (
            <button
              type="button"
              onClick={create}
              // Blocked in the UI as well as the API: the server refuses an oversized split with a
              // 413, and letting the button through only to show that error is worse than not
              // offering it.
              disabled={creating || !estimate || (grouping === "video_per_item" && splitCount > MAX_SPLIT_ITEMS)}
              className="btn-primary disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create project"}
            </button>
          )}
        </div>
      </div>

      <EstimatePanel estimate={estimate} loading={loading} error={step === 0 ? error : null} />
    </div>
  );
}

function Slider({
  id, label: text, min, max, step, value, onChange, display, hint,
}: {
  id: string; label: string; min: number; max: number; step: number;
  value: number; onChange: (v: number) => void; display: string; hint?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-sm font-semibold text-charcoal" htmlFor={id}>{text}</label>
        <span className="text-sm text-primary font-medium tabular-nums">{display}</span>
      </div>
      <input
        id={id} type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
      {hint && <p className="text-xs text-secondary mt-1">{hint}</p>}
    </div>
  );
}
