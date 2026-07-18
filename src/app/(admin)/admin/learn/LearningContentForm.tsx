"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminCard } from "@/components/admin/AdminCard";
import { GenerateContentButton } from "@/components/admin/GenerateContentButton";
import { GenerateImageModal } from "@/components/admin/GenerateImageModal";
import { LearnInlineImageGenerator } from "@/components/admin/LearnInlineImageGenerator";
import { SidecarExamplesSection } from "@/components/admin/SidecarExamplesSection";
import { KanjiStrokePreview } from "@/components/admin/KanjiStrokePreview";
import { ContentBlocksSection } from "@/components/admin/ContentBlocksSection";
import { PracticeTestBuilder } from "@/components/admin/PracticeTestBuilder";

type Item = {
  id: string;
  slug: string;
  title: string;
  content: string | null;
  jlpt_level: string | null;
  tags: string[] | null;
  meta: Record<string, unknown> | null;
  status: string;
  sort_order: number;
};

type UsedInLesson = { lesson_id: string; lesson_title: string; lesson_code: string; module_title: string; level_code: string };

/** Content types with a dedicated editor: structured fields bind to real sidecar-table columns, not meta. */
const SIDECAR_TYPES = new Set(["vocabulary", "grammar", "kanji", "practice_test", "reading", "listening", "writing"]);
/** Of SIDECAR_TYPES, the ones with a real Examples-table CRUD section (reading/listening/writing/practice_test
 * use content_blocks instead; all SIDECAR_TYPES still get the "used in lessons" reverse lookup). */
const SIDECAR_TYPES_WITH_EXAMPLES = new Set(["vocabulary", "grammar", "kanji"]);

export function LearningContentForm({
  contentType,
  item,
  editBasePath = "learn",
  sidecar = null,
  usedInLessons = [],
}: {
  contentType: string;
  item?: Item;
  /** When "blogs", save/redirect uses /admin/blogs/[slug]/edit. */
  editBasePath?: "learn" | "blogs";
  /** Existing sidecar row (vocabulary/grammar/kanji) for content types with a dedicated editor. Null for "new" or types without one yet. */
  sidecar?: Record<string, unknown> | null;
  usedInLessons?: UsedInLesson[];
}) {
  const hasSidecar = SIDECAR_TYPES.has(contentType);
  const [sidecarState, setSidecarState] = useState<Record<string, unknown>>(sidecar ?? {});
  const sidecarId = typeof sidecarState.id === "string" ? sidecarState.id : null;

  function sidecarStr(key: string): string {
    const v = sidecarState[key];
    return v == null ? "" : String(v);
  }
  function sidecarArr(key: string): string[] {
    const v = sidecarState[key];
    if (Array.isArray(v)) return v.map((x) => (x != null ? String(x) : ""));
    return [];
  }
  function updateSidecar(key: string, value: unknown) {
    setSidecarState((s) => ({ ...s, [key]: value }));
  }
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const initialMeta = item?.meta ?? {};
  const [form, setForm] = useState({
    slug: item?.slug ?? "",
    title: item?.title ?? "",
    content: item?.content ?? "",
    jlpt_level: item?.jlpt_level ?? "",
    tags: item?.tags?.join(", ") ?? "",
    status: item?.status ?? "draft",
    sort_order: item?.sort_order ?? 0,
    meta: initialMeta as Record<string, unknown>,
  });
  const [metaJson, setMetaJson] = useState(() =>
    JSON.stringify(initialMeta, null, 2)
  );
  const [imageModalOpen, setImageModalOpen] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateMeta(next: Record<string, unknown>) {
    setForm((f) => ({ ...f, meta: next }));
    setMetaJson(JSON.stringify(next, null, 2));
  }

  function metaStr(key: string): string {
    const v = form.meta[key];
    return v == null ? "" : String(v);
  }
  function metaArr(key: string): string[] {
    const v = form.meta[key];
    if (Array.isArray(v)) return v.map((x) => (x != null ? String(x) : ""));
    return [];
  }

  type ImagePromptItem = { placeholder: string; role: string; prompt: string; aspect_ratio?: string };
  function getImagePromptItems(): ImagePromptItem[] {
    const v = form.meta.image_prompt_items;
    if (!Array.isArray(v)) return [];
    return v
      .map((x) => (typeof x === "object" && x !== null ? (x as Record<string, unknown>) : null))
      .filter(Boolean)
      .map((x) => ({
        placeholder: typeof x?.placeholder === "string" ? (x.placeholder as string) : "",
        role: typeof x?.role === "string" ? (x.role as string) : "",
        prompt: typeof x?.prompt === "string" ? (x.prompt as string) : "",
        aspect_ratio: typeof x?.aspect_ratio === "string" ? (x.aspect_ratio as string) : undefined,
      }))
      .filter((x) => x.placeholder && x.role && x.prompt);
  }

  function getGeneratedImages(): Record<string, string> {
    const v = form.meta.generated_images;
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === "string") out[k] = val;
    }
    return out;
  }

  function buildMetaFromEditor(): Record<string, unknown> {
    try {
      const p = metaJson.trim() ? JSON.parse(metaJson) : {};
      return typeof p === "object" && p !== null && !Array.isArray(p) ? (p as Record<string, unknown>) : form.meta;
    } catch {
      return form.meta;
    }
  }

  async function persistToDb(opts?: {
    content?: string;
    meta?: Record<string, unknown>;
    preferReplaceUrl?: boolean;
  }) {
    const metaPayload = opts?.meta ?? buildMetaFromEditor();
    const contentPayload = opts?.content ?? (form.content ?? "");

    if (!form.slug || !form.title) {
      setStatus("error");
      setErrorMessage("slug and title required");
      return { ok: false as const };
    }

    const url = item
      ? `/api/admin/learning-content/${contentType}/${item.slug}`
      : `/api/admin/learning-content/${contentType}`;
    const res = await fetch(url, {
      method: item ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: form.slug,
        title: form.title,
        content: contentPayload,
        jlpt_level: form.jlpt_level || null,
        tags: form.tags ? form.tags.split(",").map((s) => s.trim()).filter(Boolean) : [],
        status: form.status,
        sort_order: form.sort_order,
        meta: metaPayload,
        sidecar: hasSidecar ? sidecarState : undefined,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus("error");
      setErrorMessage((data as { error?: string })?.error ?? "Failed to save");
      return { ok: false as const };
    }

    setErrorMessage("");
    const data = (await res.json().catch(() => ({}))) as { slug?: string };

    if (opts?.preferReplaceUrl !== false) {
      const base = editBasePath === "blogs" ? "/admin/blogs" : `/admin/learn/${contentType}`;
      const editPath = editBasePath === "blogs" ? (s: string) => `${base}/${s}/edit` : (s: string) => `${base}/${s}/edit`;
      if (item) {
        const newSlug = String(form.slug).trim();
        if (newSlug && newSlug !== item.slug) {
          router.replace(editPath(newSlug));
        }
      } else {
        const slug = data.slug ?? form.slug;
        if (slug) router.replace(editPath(String(slug).trim()));
      }
    }

    router.refresh();
    return { ok: true as const, slug: data.slug };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const result = await persistToDb({ preferReplaceUrl: true });
      if (!result.ok) return;
      setStatus("idle");
    } catch {
      setStatus("error");
      setErrorMessage("Failed to save");
    }
  }

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-6">
      <AdminCard>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              required
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Slug</label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => update("slug", e.target.value)}
              required
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-charcoal">Content</label>
              <GenerateContentButton
                contentType={contentType as import("@/lib/ai/prompts").ContentType}
                context={{
                  jlptLevel: form.jlpt_level || undefined,
                  topic: form.title,
                  tags: form.tags,
                  description: metaStr("summary") || form.content?.slice(0, 200) || undefined,
                  pattern: contentType === "grammar" ? (sidecarStr("pattern") || undefined) : undefined,
                  word: contentType === "vocabulary" ? (sidecarStr("word") || form.title || undefined) : undefined,
                  character: contentType === "kanji" ? (sidecarStr("character") || undefined) : undefined,
                  meaning: hasSidecar ? (sidecarStr("meaning") || undefined) : (metaStr("meaning") || undefined),
                  structure: contentType === "grammar" ? (sidecarStr("structure") || undefined) : undefined,
                }}
                onGenerated={(data) => {
                  if (typeof data === "string") {
                    update("content", data);
                    return;
                  }
                  const obj = data as {
                    content?: string;
                    feature_image_prompt?: string;
                    image_prompt_items?: ImagePromptItem[];
                  };
                  if (typeof obj.content === "string") update("content", obj.content);
                  if (typeof obj.feature_image_prompt === "string") {
                    updateMeta({ ...form.meta, image_prompt: obj.feature_image_prompt });
                  }
                  if (Array.isArray(obj.image_prompt_items) && obj.image_prompt_items.length > 0) {
                    updateMeta({
                      ...form.meta,
                      image_prompt_items: obj.image_prompt_items,
                      generated_images: form.meta.generated_images ?? {},
                    });
                  }
                }}
              />
            </div>
            <textarea
              value={form.content}
              onChange={(e) => update("content", e.target.value)}
              rows={10}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal font-mono text-sm"
              placeholder="Main lesson content: explanations, examples, practice. Use Generate with AI above for a draft."
            />

            {/* All images in this content (below content): feature + every inline slot, with thumbnail or placeholder */}
            {(metaStr("feature_image_url") || getImagePromptItems().length > 0) && (
              <div className="mt-4 p-4 border border-[var(--divider)] rounded-bento bg-[var(--base)]">
                <h3 className="text-sm font-semibold text-charcoal mb-3">All images in this content</h3>
                <div className="flex flex-wrap gap-3">
                  {metaStr("feature_image_url") && (
                    <div className="flex flex-col items-start">
                      <span className="text-xs text-secondary mb-1">Feature image</span>
                      <div className="rounded overflow-hidden border border-[var(--divider)] w-24 h-24 bg-[var(--divider)]/20 shrink-0">
                        <img src={metaStr("feature_image_url")} alt="" className="w-full h-full object-cover" />
                      </div>
                    </div>
                  )}
                  {getImagePromptItems().map((it) => {
                    const url = getGeneratedImages()[it.placeholder];
                    return (
                      <div key={it.placeholder} className="flex flex-col items-start">
                        <span className="text-xs text-secondary mb-1">{it.role}</span>
                        <div className="rounded overflow-hidden border border-[var(--divider)] w-24 h-24 bg-[var(--divider)]/20 shrink-0 flex items-center justify-center">
                          {url ? (
                            <img src={url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs text-secondary">No image</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <LearnInlineImageGenerator
              items={getImagePromptItems()}
              content={form.content ?? ""}
              generated={getGeneratedImages()}
              onContentUpdate={(c) => update("content", c)}
              onItemsUpdate={(items) => updateMeta({ ...form.meta, image_prompt_items: items })}
              onGeneratedUpdate={(generated) => updateMeta({ ...form.meta, generated_images: generated })}
              onAutoSave={async ({ content, items, generated }) => {
                const nextMeta = {
                  ...buildMetaFromEditor(),
                  image_prompt_items: items,
                  generated_images: generated,
                };
                await persistToDb({ content, meta: nextMeta, preferReplaceUrl: true });
              }}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">JLPT level</label>
              <select
                value={form.jlpt_level}
                onChange={(e) => update("jlpt_level", e.target.value)}
                className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
              >
                <option value="">—</option>
                <option value="N5">N5</option>
                <option value="N4">N4</option>
                <option value="N3">N3</option>
                <option value="N2">N2</option>
                <option value="N1">N1</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Tags (comma)</label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => update("tags", e.target.value)}
                className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => update("status", e.target.value)}
                className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Sort order</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => update("sort_order", parseInt(e.target.value, 10) || 0)}
                className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
              />
            </div>
          </div>

          {/* Common meta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Summary (meta)</label>
              <input
                type="text"
                value={metaStr("summary")}
                onChange={(e) => updateMeta({ ...form.meta, summary: e.target.value || undefined })}
                className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                placeholder="Short description for cards"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Audio URL (meta)</label>
              <input
                type="url"
                value={metaStr("audio_url")}
                onChange={(e) => updateMeta({ ...form.meta, audio_url: e.target.value || undefined })}
                className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Feature image & list/card view */}
          <div className="space-y-4 pt-2 border-t border-[var(--divider)]">
            <h3 className="text-sm font-medium text-charcoal">Feature image & list view</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">Feature image URL (meta)</label>
                <input
                  type="url"
                  value={metaStr("feature_image_url")}
                  onChange={(e) => updateMeta({ ...form.meta, feature_image_url: e.target.value || undefined })}
                  className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                  placeholder="https://... or generate below"
                />
                {metaStr("feature_image_url") && (
                  <div className="mt-2 rounded-bento overflow-hidden border border-[var(--divider)] w-24 h-24 object-cover bg-[var(--divider)]/20">
                    <img src={metaStr("feature_image_url")} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-charcoal mb-1">List/Card image prompt (meta)</label>
                <textarea
                  value={metaStr("image_prompt")}
                  onChange={(e) => updateMeta({ ...form.meta, image_prompt: e.target.value || undefined })}
                  rows={2}
                  className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal text-sm"
                  placeholder="Prompt for AI card/list image (optional)"
                />
                <button
                  type="button"
                  onClick={() => setImageModalOpen(true)}
                  className="mt-2 text-sm text-primary hover:underline"
                >
                  Generate image (AI)
                </button>
              </div>
            </div>
          </div>

          {/* Type-specific meta */}
          {contentType === "vocabulary" && (
            <div className="space-y-4 pt-2 border-t border-[var(--divider)]">
              <h3 className="text-sm font-medium text-charcoal">Vocabulary</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-secondary mb-1">Japanese</label>
                  <input
                    type="text"
                    value={sidecarStr("word")}
                    onChange={(e) => updateSidecar("word", e.target.value || undefined)}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                  />
                </div>
                <div>
                  <label className="block text-sm text-secondary mb-1">Reading (furigana)</label>
                  <input
                    type="text"
                    value={sidecarStr("reading")}
                    onChange={(e) => updateSidecar("reading", e.target.value || undefined)}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                  />
                </div>
                <div>
                  <label className="block text-sm text-secondary mb-1">Romaji</label>
                  <input
                    type="text"
                    value={sidecarStr("romaji")}
                    onChange={(e) => updateSidecar("romaji", e.target.value || undefined)}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                  />
                </div>
                <div>
                  <label className="block text-sm text-secondary mb-1">Meaning</label>
                  <input
                    type="text"
                    value={sidecarStr("meaning")}
                    onChange={(e) => updateSidecar("meaning", e.target.value || undefined)}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                  />
                </div>
                <div>
                  <label className="block text-sm text-secondary mb-1">Part of speech (e.g. Noun, Verb)</label>
                  <input
                    type="text"
                    value={sidecarStr("part_of_speech")}
                    onChange={(e) => updateSidecar("part_of_speech", e.target.value || undefined)}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                  />
                </div>
                <div>
                  <label className="block text-sm text-secondary mb-1">Transitivity (verbs only, optional)</label>
                  <input
                    type="text"
                    value={sidecarStr("transitivity")}
                    onChange={(e) => updateSidecar("transitivity", e.target.value || undefined)}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                    placeholder="transitive / intransitive"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm text-secondary mb-1">Notes (when to use, nuance)</label>
                  <textarea
                    value={sidecarStr("notes")}
                    onChange={(e) => updateSidecar("notes", e.target.value || undefined)}
                    rows={2}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                  />
                </div>
              </div>
            </div>
          )}
          {contentType === "grammar" && (
            <div className="space-y-4 pt-2 border-t border-[var(--divider)]">
              <h3 className="text-sm font-medium text-charcoal">Grammar</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-secondary mb-1">Pattern (日本語)</label>
                  <input
                    type="text"
                    value={sidecarStr("pattern")}
                    onChange={(e) => updateSidecar("pattern", e.target.value || undefined)}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                  />
                </div>
                <div>
                  <label className="block text-sm text-secondary mb-1">Structure</label>
                  <input
                    type="text"
                    value={sidecarStr("structure")}
                    onChange={(e) => updateSidecar("structure", e.target.value || undefined)}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                    placeholder="[TOPIC] は [comment]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm text-secondary mb-1">Meaning</label>
                  <input
                    type="text"
                    value={sidecarStr("meaning")}
                    onChange={(e) => updateSidecar("meaning", e.target.value || undefined)}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm text-secondary mb-1">When to use</label>
                  <textarea
                    value={sidecarStr("when_to_use")}
                    onChange={(e) => updateSidecar("when_to_use", e.target.value || undefined)}
                    rows={3}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                    placeholder="Explain the situations/nuance where this grammar point applies"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm text-secondary mb-1">Notes (optional)</label>
                  <textarea
                    value={sidecarStr("notes")}
                    onChange={(e) => updateSidecar("notes", e.target.value || undefined)}
                    rows={2}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                  />
                </div>
              </div>
            </div>
          )}
          {contentType === "kanji" && (
            <div className="space-y-4 pt-2 border-t border-[var(--divider)]">
              <h3 className="text-sm font-medium text-charcoal">Kanji</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-secondary mb-1">Character</label>
                  <input
                    type="text"
                    value={sidecarStr("character")}
                    onChange={(e) => updateSidecar("character", e.target.value || undefined)}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                  />
                </div>
                <div>
                  <label className="block text-sm text-secondary mb-1">Meaning</label>
                  <input
                    type="text"
                    value={sidecarStr("meaning")}
                    onChange={(e) => updateSidecar("meaning", e.target.value || undefined)}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                  />
                </div>
                <div>
                  <label className="block text-sm text-secondary mb-1">Onyomi</label>
                  <input
                    type="text"
                    value={sidecarArr("onyomi").join(", ")}
                    onChange={(e) => updateSidecar("onyomi", e.target.value ? e.target.value.split(/[\s,]+/).filter(Boolean) : undefined)}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                    placeholder="ニチ, ジツ"
                  />
                </div>
                <div>
                  <label className="block text-sm text-secondary mb-1">Kunyomi</label>
                  <input
                    type="text"
                    value={sidecarArr("kunyomi").join(", ")}
                    onChange={(e) => updateSidecar("kunyomi", e.target.value ? e.target.value.split(/[\s,]+/).filter(Boolean) : undefined)}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                    placeholder="ひ, か"
                  />
                </div>
                <div>
                  <label className="block text-sm text-secondary mb-1">Stroke count</label>
                  <input
                    type="number"
                    value={sidecarStr("stroke_count")}
                    onChange={(e) => updateSidecar("stroke_count", e.target.value ? parseInt(e.target.value, 10) : undefined)}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm text-secondary mb-1">Extended meaning / usage notes (optional)</label>
                  <textarea
                    value={sidecarStr("meaning_extended")}
                    onChange={(e) => updateSidecar("meaning_extended", e.target.value || undefined)}
                    rows={2}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                  />
                </div>
              </div>
              {sidecarStr("character") && (
                <KanjiStrokePreview
                  character={sidecarStr("character")}
                  strokeCount={sidecarStr("stroke_count") ? Number(sidecarStr("stroke_count")) : null}
                  reading={sidecarArr("onyomi")[0] ?? sidecarArr("kunyomi")[0] ?? null}
                />
              )}
            </div>
          )}
          {hasSidecar && sidecarId && SIDECAR_TYPES_WITH_EXAMPLES.has(contentType) && (
            <SidecarExamplesSection contentType={contentType as "vocabulary" | "grammar" | "kanji"} sidecarId={sidecarId} />
          )}
          {hasSidecar && usedInLessons.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[var(--divider)]">
              <h3 className="text-sm font-medium text-charcoal">Used in lessons</h3>
              <div className="flex flex-wrap gap-2">
                {usedInLessons.map((u) => (
                  <a
                    key={u.lesson_id}
                    href={`/admin/learn/curriculum/lessons/${u.lesson_id}`}
                    className="text-[11px] px-2 py-1 rounded-full bg-primary/5 text-primary border border-primary/20 font-semibold hover:bg-primary/10 transition"
                    title={`${u.level_code} — ${u.module_title} — ${u.lesson_title}`}
                  >
                    {u.level_code} {u.lesson_code}
                  </a>
                ))}
              </div>
            </div>
          )}
          {hasSidecar && (contentType === "vocabulary" || contentType === "grammar" || contentType === "kanji") && (
            <div className="space-y-4 pt-2 border-t border-[var(--divider)]">
              <h3 className="text-sm font-medium text-charcoal">Rich content</h3>
              <p className="text-sm text-secondary">
                {contentType === "kanji"
                  ? "Optional deeper teaching content: radicals, visually similar kanji, and memory aids — beyond the core fields above."
                  : contentType === "grammar"
                  ? "Optional deeper teaching content: formation variants, nuance, register, and common restrictions — beyond the core fields above."
                  : "Optional deeper teaching content: collocations and related words — beyond the core fields above."}
              </p>
              {item ? (
                <ContentBlocksSection postId={item.id} />
              ) : (
                <p className="text-xs text-secondary italic">Save once to add rich content blocks.</p>
              )}
            </div>
          )}
          {contentType === "reading" && (
            <div className="space-y-4 pt-2 border-t border-[var(--divider)]">
              <h3 className="text-sm font-medium text-charcoal">Reading</h3>
              <p className="text-sm text-secondary">
                Build the passage and comprehension questions from content blocks below — a Reading Passage block (with furigana/plain versions) plus Comprehension Question blocks.
              </p>
              {item ? (
                <ContentBlocksSection postId={item.id} />
              ) : (
                <p className="text-xs text-secondary italic">Save once to add content blocks.</p>
              )}
            </div>
          )}
          {contentType === "listening" && (
            <div className="space-y-4 pt-2 border-t border-[var(--divider)]">
              <h3 className="text-sm font-medium text-charcoal">Listening</h3>
              <p className="text-sm text-secondary">
                Build the scenario from content blocks below — an Audio block (transcript + duration required to publish) plus at least 3 Comprehension Question blocks, each with an explanation.
              </p>
              {item ? (
                <ContentBlocksSection postId={item.id} />
              ) : (
                <p className="text-xs text-secondary italic">Save once to add content blocks.</p>
              )}
            </div>
          )}
          {contentType === "writing" && (
            <div className="space-y-4 pt-2 border-t border-[var(--divider)]">
              <h3 className="text-sm font-medium text-charcoal">Writing</h3>
              <p className="text-sm text-secondary">
                Build the composition exercise from content blocks below — a Writing Prompt block (task/conditions), a Japanese Learning Text block for the model answer, and Rich Text/Section Heading blocks for evaluation notes and practice advice.
              </p>
              {item ? (
                <ContentBlocksSection postId={item.id} />
              ) : (
                <p className="text-xs text-secondary italic">Save once to add content blocks.</p>
              )}
            </div>
          )}
          {contentType === "practice_test" && (
            <div className="space-y-4 pt-2 border-t border-[var(--divider)]">
              <h3 className="text-sm font-medium text-charcoal">Practice test settings</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-secondary mb-1">Duration (minutes)</label>
                  <input
                    type="number"
                    value={sidecarStr("duration_minutes")}
                    onChange={(e) => updateSidecar("duration_minutes", e.target.value ? parseInt(e.target.value, 10) : undefined)}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                    placeholder="60"
                  />
                </div>
                <div>
                  <label className="block text-sm text-secondary mb-1">Passing score (%)</label>
                  <input
                    type="number"
                    value={sidecarStr("passing_score_percent")}
                    onChange={(e) => updateSidecar("passing_score_percent", e.target.value ? parseInt(e.target.value, 10) : undefined)}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                    placeholder="60"
                  />
                </div>
                <div>
                  <label className="block text-sm text-secondary mb-1">Format</label>
                  <select
                    value={sidecarStr("test_variant") || "full"}
                    onChange={(e) => updateSidecar("test_variant", e.target.value)}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal bg-white"
                  >
                    <option value="full">Full mock test</option>
                    <option value="mini">Mini mock test</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-secondary mb-1">Attempt policy</label>
                  <select
                    value={sidecarStr("attempt_policy") || "unlimited"}
                    onChange={(e) => updateSidecar("attempt_policy", e.target.value)}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal bg-white"
                  >
                    <option value="unlimited">Unlimited attempts</option>
                    <option value="one_time">One attempt only</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm text-secondary mb-1">Instructions</label>
                  <textarea
                    value={sidecarStr("instructions")}
                    onChange={(e) => updateSidecar("instructions", e.target.value || undefined)}
                    rows={2}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                    placeholder="Shown before the learner starts the test"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm text-secondary mb-1">Official PDF URL (optional supplementary download)</label>
                  <input
                    type="url"
                    value={sidecarStr("pdf_url")}
                    onChange={(e) => updateSidecar("pdf_url", e.target.value || undefined)}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                    placeholder="https://..."
                  />
                </div>
              </div>
              <p className="text-xs text-secondary italic">Save once to build sections and questions below.</p>
              {item && <PracticeTestBuilder postId={item.id} jlptLevel={form.jlpt_level} />}
            </div>
          )}
          {contentType === "sounds" && (
            <div className="space-y-4 pt-2 border-t border-[var(--divider)]">
              <h3 className="text-sm font-medium text-charcoal">Sounds / Kana</h3>
              <p className="text-sm text-secondary">
                Use &quot;Meta (JSON)&quot; for <code className="bg-[var(--divider)] px-1 rounded">characters</code>: array of <code className="bg-[var(--divider)] px-1 rounded">hiragana</code>, <code className="bg-[var(--divider)] px-1 rounded">katakana</code>, <code className="bg-[var(--divider)] px-1 rounded">romaji</code>, <code className="bg-[var(--divider)] px-1 rounded">meaning</code>. Optional summary.
              </p>
            </div>
          )}
          {contentType === "study_guide" && (
            <div className="space-y-4 pt-2 border-t border-[var(--divider)]">
              <h3 className="text-sm font-medium text-charcoal">Study guide</h3>
              <p className="text-sm text-secondary">
                Main text in Content above. Optional <code className="bg-[var(--divider)] px-1 rounded">links</code> array in Meta (JSON).
              </p>
            </div>
          )}
          {contentType === "conversation" && (
            <div className="space-y-4 pt-2 border-t border-[var(--divider)]">
              <h3 className="text-sm font-medium text-charcoal">Conversation</h3>
              <p className="text-sm text-secondary">
                Build the scenario from content blocks below — dialogue lines, speaking prompts, audio, vocabulary/grammar tie-ins.
              </p>
              {item ? (
                <ContentBlocksSection postId={item.id} />
              ) : (
                <p className="text-xs text-secondary italic">Save once to add content blocks.</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Meta (JSON, optional)</label>
              <p className="text-xs text-secondary mb-1">
                Per-section audio: <code className="bg-[var(--divider)] px-1 rounded">section_audio</code> with keys matching content headings (e.g. &quot;Meaning&quot;, &quot;Simple Explanation&quot;) and audio URLs.
              </p>
            <textarea
              value={metaJson}
              onChange={(e) => {
                setMetaJson(e.target.value);
                try {
                  const parsed = e.target.value.trim() ? JSON.parse(e.target.value) : {};
                  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
                    setForm((f) => ({ ...f, meta: parsed }));
                  }
                } catch {
                  // keep previous form.meta on parse error
                }
              }}
              rows={6}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal font-mono text-sm"
              placeholder="{}"
            />
          </div>
        </div>
      </AdminCard>

      <div className="flex items-center gap-4">
        <button type="submit" className="btn-primary" disabled={status === "loading"}>
          {status === "loading" ? "Saving..." : "Save"}
        </button>
        {status === "error" && errorMessage && (
          <span className="text-red-600 text-sm">{errorMessage}</span>
        )}
      </div>
    </form>
    <GenerateImageModal
      open={imageModalOpen}
      onClose={() => setImageModalOpen(false)}
      imageType="learning"
      initialContext={{
        topic: form.title,
        title: form.title,
        jlptLevel: form.jlpt_level || undefined,
        contentType: contentType,
        description: form.content?.slice(0, 200) || undefined,
      }}
      initialPrompt={metaStr("image_prompt") || undefined}
      onGenerated={(url) => {
        setForm((f) => {
          const nextMeta = { ...(f.meta as Record<string, unknown>), feature_image_url: url };
          setMetaJson(JSON.stringify(nextMeta, null, 2));
          return { ...f, meta: nextMeta };
        });
        // Persist immediately so feature image isn't lost on refresh/navigation
        void persistToDb({
          meta: { ...buildMetaFromEditor(), feature_image_url: url },
          preferReplaceUrl: true,
        });
        setImageModalOpen(false);
      }}
    />
  </>
  );
}
