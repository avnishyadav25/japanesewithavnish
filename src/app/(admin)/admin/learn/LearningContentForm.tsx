"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminCard } from "@/components/admin/AdminCard";
import { GenerateContentButton } from "@/components/admin/GenerateContentButton";
import { GenerateImageModal } from "@/components/admin/GenerateImageModal";
import { LearnInlineImageGenerator } from "@/components/admin/LearnInlineImageGenerator";

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

export function LearningContentForm({
  contentType,
  item,
}: {
  contentType: string;
  item?: Item;
}) {
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

  type ExampleRow = { japanese?: string; romaji?: string; translation?: string };
  function getExamples(): ExampleRow[] {
    const v = form.meta.examples;
    if (!Array.isArray(v)) return [];
    return v.map((x) =>
      typeof x === "object" && x !== null
        ? {
            japanese: x && typeof (x as Record<string, unknown>).japanese === "string" ? (x as Record<string, unknown>).japanese as string : "",
            romaji: x && typeof (x as Record<string, unknown>).romaji === "string" ? (x as Record<string, unknown>).romaji as string : "",
            translation: x && typeof (x as Record<string, unknown>).translation === "string" ? (x as Record<string, unknown>).translation as string : "",
          }
        : { japanese: "", romaji: "", translation: "" }
    );
  }
  function setExamples(next: ExampleRow[]) {
    updateMeta({ ...form.meta, examples: next.length ? next : undefined });
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
      if (item) {
        const newSlug = String(form.slug).trim();
        if (newSlug && newSlug !== item.slug) {
          router.replace(`/admin/learn/${contentType}/${newSlug}/edit`);
        }
      } else {
        const slug = data.slug ?? form.slug;
        if (slug) router.replace(`/admin/learn/${contentType}/${String(slug).trim()}/edit`);
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
                  pattern: contentType === "grammar" ? (metaStr("grammar_form") || metaStr("reading") || undefined) : undefined,
                  word: contentType === "vocabulary" ? (metaStr("japanese") || form.title || undefined) : undefined,
                  character: contentType === "kanji" ? (metaStr("character") || undefined) : undefined,
                  meaning: metaStr("meaning") || undefined,
                  structure: contentType === "grammar" ? (metaStr("structure") || undefined) : undefined,
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
                    value={metaStr("japanese")}
                    onChange={(e) => updateMeta({ ...form.meta, japanese: e.target.value || undefined })}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                  />
                </div>
                <div>
                  <label className="block text-sm text-secondary mb-1">Reading (romaji)</label>
                  <input
                    type="text"
                    value={metaStr("reading")}
                    onChange={(e) => updateMeta({ ...form.meta, reading: e.target.value || undefined })}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                  />
                </div>
                <div>
                  <label className="block text-sm text-secondary mb-1">Type (e.g. Noun, Verb)</label>
                  <input
                    type="text"
                    value={metaStr("type")}
                    onChange={(e) => updateMeta({ ...form.meta, type: e.target.value || undefined })}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                  />
                </div>
                <div>
                  <label className="block text-sm text-secondary mb-1">Meaning</label>
                  <input
                    type="text"
                    value={metaStr("meaning")}
                    onChange={(e) => updateMeta({ ...form.meta, meaning: e.target.value || undefined })}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                  />
                </div>
              </div>
              <p className="text-xs text-secondary mt-2">Add 8–12 <code className="bg-[var(--divider)] px-1 rounded">examples</code> in Meta (JSON): japanese, romaji, translation.</p>
            </div>
          )}
          {contentType === "grammar" && (
            <div className="space-y-4 pt-2 border-t border-[var(--divider)]">
              <h3 className="text-sm font-medium text-charcoal">Grammar</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-secondary mb-1">Grammar form (日本語)</label>
                  <input
                    type="text"
                    value={metaStr("grammar_form")}
                    onChange={(e) => updateMeta({ ...form.meta, grammar_form: e.target.value || undefined })}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                  />
                </div>
                <div>
                  <label className="block text-sm text-secondary mb-1">Reading (romaji)</label>
                  <input
                    type="text"
                    value={metaStr("reading")}
                    onChange={(e) => updateMeta({ ...form.meta, reading: e.target.value || undefined })}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm text-secondary mb-1">Meaning</label>
                  <input
                    type="text"
                    value={metaStr("meaning")}
                    onChange={(e) => updateMeta({ ...form.meta, meaning: e.target.value || undefined })}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm text-secondary mb-1">Structure (optional)</label>
                  <input
                    type="text"
                    value={metaStr("structure")}
                    onChange={(e) => updateMeta({ ...form.meta, structure: e.target.value || undefined })}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                    placeholder="[TOPIC] は [comment]"
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
                    value={metaStr("character")}
                    onChange={(e) => updateMeta({ ...form.meta, character: e.target.value || undefined })}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                  />
                </div>
                <div>
                  <label className="block text-sm text-secondary mb-1">Meaning</label>
                  <input
                    type="text"
                    value={metaStr("meaning")}
                    onChange={(e) => updateMeta({ ...form.meta, meaning: e.target.value || undefined })}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                  />
                </div>
                <div>
                  <label className="block text-sm text-secondary mb-1">Onyomi</label>
                  <input
                    type="text"
                    value={metaStr("onyomi")}
                    onChange={(e) =>
                      updateMeta({
                        ...form.meta,
                        onyomi: e.target.value ? e.target.value.split(/[\s,]+/).filter(Boolean) : undefined,
                      })
                    }
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                    placeholder="ニチ, ジツ"
                  />
                </div>
                <div>
                  <label className="block text-sm text-secondary mb-1">Kunyomi</label>
                  <input
                    type="text"
                    value={Array.isArray(form.meta.kunyomi) ? (form.meta.kunyomi as string[]).join(", ") : metaStr("kunyomi")}
                    onChange={(e) =>
                      updateMeta({
                        ...form.meta,
                        kunyomi: e.target.value ? e.target.value.split(/[\s,]+/).filter(Boolean) : undefined,
                      })
                    }
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                    placeholder="ひ, か"
                  />
                </div>
                <div>
                  <label className="block text-sm text-secondary mb-1">Stroke count</label>
                  <input
                    type="number"
                    value={metaStr("stroke_count")}
                    onChange={(e) =>
                      updateMeta({
                        ...form.meta,
                        stroke_count: e.target.value ? parseInt(e.target.value, 10) : undefined,
                      })
                    }
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                  />
                </div>
              </div>
              <p className="text-xs text-secondary mt-2">Add 8–12 <code className="bg-[var(--divider)] px-1 rounded">examples</code> in Meta (JSON): japanese, romaji, translation (compounds/sentences).</p>
            </div>
          )}
          {contentType === "reading" && (
            <div className="space-y-4 pt-2 border-t border-[var(--divider)]">
              <h3 className="text-sm font-medium text-charcoal">Reading / practice</h3>
              <p className="text-sm text-secondary">
                Use &quot;Meta (JSON)&quot; below for <code className="bg-[var(--divider)] px-1 rounded">sentences</code> (8–12 items: japanese, romaji, translation). Optional <code className="bg-[var(--divider)] px-1 rounded">summary</code>, <code className="bg-[var(--divider)] px-1 rounded">audio_url</code>.
              </p>
            </div>
          )}
          {contentType === "listening" && (
            <div className="space-y-4 pt-2 border-t border-[var(--divider)]">
              <h3 className="text-sm font-medium text-charcoal">Listening</h3>
              <p className="text-sm text-secondary">
                Use &quot;Meta (JSON)&quot; for <code className="bg-[var(--divider)] px-1 rounded">summary</code> and <code className="bg-[var(--divider)] px-1 rounded">examples</code> (8–12: japanese, romaji, translation). Optional <code className="bg-[var(--divider)] px-1 rounded">audio_url</code> above.
              </p>
            </div>
          )}
          {contentType === "writing" && (
            <div className="space-y-4 pt-2 border-t border-[var(--divider)]">
              <h3 className="text-sm font-medium text-charcoal">Writing</h3>
              <p className="text-sm text-secondary">
                Use &quot;Meta (JSON)&quot; for <code className="bg-[var(--divider)] px-1 rounded">summary</code> and <code className="bg-[var(--divider)] px-1 rounded">examples</code> (8–12: japanese, romaji, translation).
              </p>
            </div>
          )}
          {contentType === "practice_test" && (
            <div className="space-y-4 pt-2 border-t border-[var(--divider)]">
              <h3 className="text-sm font-medium text-charcoal">Practice test</h3>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm text-secondary mb-1">PDF URL</label>
                  <input
                    type="url"
                    value={metaStr("pdf_url")}
                    onChange={(e) => updateMeta({ ...form.meta, pdf_url: e.target.value || undefined })}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="block text-sm text-secondary mb-1">Audio URLs (one per line)</label>
                  <textarea
                    value={metaArr("audio_urls").join("\n")}
                    onChange={(e) =>
                      updateMeta({
                        ...form.meta,
                        audio_urls: e.target.value
                          ? e.target.value.split("\n").map((s) => s.trim()).filter(Boolean)
                          : undefined,
                      })
                    }
                    rows={3}
                    className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal font-mono text-sm"
                    placeholder="https://...section1.mp3"
                  />
                </div>
              </div>
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

          {/* Examples array (grammar, vocabulary, kanji, listening, writing) */}
          {["grammar", "vocabulary", "kanji", "listening", "writing"].includes(contentType) && (
            <div className="space-y-4 pt-2 border-t border-[var(--divider)]">
              <h3 className="text-sm font-medium text-charcoal">Examples</h3>
              <p className="text-xs text-secondary mb-2">Each row: Japanese, romaji, translation. Shown on the lesson page with per-example sound.</p>
              <div className="space-y-3">
                {getExamples().map((ex, i) => (
                  <div key={i} className="flex flex-wrap items-start gap-2 p-3 rounded-bento border border-[var(--divider)] bg-[var(--divider)]/10">
                    <input
                      type="text"
                      placeholder="Japanese"
                      value={ex.japanese ?? ""}
                      onChange={(e) => {
                        const list = getExamples();
                        list[i] = { ...list[i], japanese: e.target.value };
                        setExamples(list);
                      }}
                      className="flex-1 min-w-[120px] px-3 py-2 border border-[var(--divider)] rounded-bento text-charcoal text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Romaji"
                      value={ex.romaji ?? ""}
                      onChange={(e) => {
                        const list = getExamples();
                        list[i] = { ...list[i], romaji: e.target.value };
                        setExamples(list);
                      }}
                      className="flex-1 min-w-[120px] px-3 py-2 border border-[var(--divider)] rounded-bento text-charcoal text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Translation"
                      value={ex.translation ?? ""}
                      onChange={(e) => {
                        const list = getExamples();
                        list[i] = { ...list[i], translation: e.target.value };
                        setExamples(list);
                      }}
                      className="flex-1 min-w-[120px] px-3 py-2 border border-[var(--divider)] rounded-bento text-charcoal text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setExamples(getExamples().filter((_, j) => j !== i))}
                      className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-bento border border-[var(--divider)]"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setExamples([...getExamples(), { japanese: "", romaji: "", translation: "" }])}
                  className="px-4 py-2 text-sm border border-[var(--divider)] rounded-bento text-charcoal hover:bg-[var(--divider)]/20"
                >
                  Add example
                </button>
              </div>
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
