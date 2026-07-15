"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminCard } from "@/components/admin/AdminCard";
import { GenerateContentButton } from "@/components/admin/GenerateContentButton";
import { GenerateImageModal } from "@/components/admin/GenerateImageModal";

type GuideSection = {
  id?: string;
  title: string;
  slug: string;
  short_description: string;
  body: string;
  icon: string;
  feature_image_url: string;
  link_href: string;
  link_label: string;
  sort_order: number;
  published: boolean;
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function GuideSectionForm({ section }: { section?: GuideSection }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [form, setForm] = useState({
    title: section?.title ?? "",
    slug: section?.slug ?? "",
    short_description: section?.short_description ?? "",
    body: section?.body ?? "",
    icon: section?.icon ?? "",
    feature_image_url: section?.feature_image_url ?? "",
    link_href: section?.link_href ?? "",
    link_label: section?.link_label ?? "",
    sort_order: String(section?.sort_order ?? 0),
    published: section?.published ?? true,
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage(null);
    try {
      const payload = {
        title: form.title,
        slug: form.slug || slugify(form.title),
        short_description: form.short_description,
        body: form.body || null,
        icon: form.icon || null,
        feature_image_url: form.feature_image_url || null,
        link_href: form.link_href || null,
        link_label: form.link_label || null,
        sort_order: Number(form.sort_order) || 0,
        published: form.published,
      };
      const res = section?.id
        ? await fetch(`/api/admin/guide-sections/${section.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/guide-sections", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save guide section");

      router.push("/admin/guide");
      router.refresh();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <AdminCard>
        <div className="space-y-4">
          <div className="grid grid-cols-[80px_1fr] gap-4">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Icon</label>
              <input
                type="text"
                placeholder="📘"
                value={form.icon}
                onChange={(e) => update("icon", e.target.value)}
                className="w-full px-3 py-2 border border-[var(--divider)] rounded-bento text-center text-charcoal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => {
                  const title = e.target.value;
                  update("title", title);
                  if (!section?.id && (!form.slug || form.slug === slugify(form.title))) {
                    update("slug", slugify(title));
                  }
                }}
                required
                className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Slug</label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => update("slug", slugify(e.target.value))}
              placeholder="jlpt-curriculum"
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal font-mono text-sm"
            />
            <p className="text-xs text-secondary mt-1">
              Public URL: /guide/{form.slug || "..."}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Short Description</label>
            <textarea
              required
              rows={2}
              value={form.short_description}
              onChange={(e) => update("short_description", e.target.value)}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
              <label className="block text-sm font-medium text-charcoal">Full Guide Text</label>
              <GenerateContentButton
                contentType="guide_section"
                context={{
                  topic: form.title,
                  description: form.short_description,
                }}
                onGenerated={(data) => {
                  if (typeof data === "string") update("body", data);
                }}
              />
            </div>
            <textarea
              rows={10}
              value={form.body}
              onChange={(e) => update("body", e.target.value)}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal font-mono text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Link URL</label>
              <input
                type="text"
                placeholder="/learn/curriculum"
                value={form.link_href}
                onChange={(e) => update("link_href", e.target.value)}
                className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Link Label</label>
              <input
                type="text"
                placeholder="Go to Curriculum"
                value={form.link_label}
                onChange={(e) => update("link_label", e.target.value)}
                className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Sort Order</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => update("sort_order", e.target.value)}
                className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Status</label>
              <select
                value={form.published ? "published" : "draft"}
                onChange={(e) => update("published", e.target.value === "published")}
                className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>
        </div>
      </AdminCard>

      <AdminCard>
        <h2 className="font-heading font-bold text-charcoal mb-4">Feature Image</h2>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-charcoal">Feature image URL</label>
              <button
                type="button"
                onClick={() => setImageModalOpen(true)}
                className="text-sm text-primary hover:underline"
              >
                {form.feature_image_url ? "Regenerate image" : "Generate image"}
              </button>
            </div>
            <input
              type="url"
              value={form.feature_image_url}
              onChange={(e) => update("feature_image_url", e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
            {form.feature_image_url && (
              <div className="mt-2 rounded-bento overflow-hidden border border-[var(--divider)] bg-[var(--base)] max-w-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.feature_image_url}
                  alt="Feature preview"
                  className="w-full aspect-video object-cover object-top"
                />
              </div>
            )}
            <GenerateImageModal
              open={imageModalOpen}
              onClose={() => setImageModalOpen(false)}
              imageType="page"
              initialContext={{
                title: form.title,
                topic: form.title,
                description: form.short_description,
              }}
              onGenerated={(result) => {
                if (result.startsWith("http://") || result.startsWith("https://")) {
                  update("feature_image_url", result);
                }
              }}
            />
          </div>
        </div>
      </AdminCard>

      <div className="flex items-center gap-4">
        <button type="submit" className="btn-primary" disabled={status === "loading"}>
          {status === "loading" ? "Saving..." : "Save"}
        </button>
        {status === "error" && errorMessage && (
          <span className="text-sm text-red-600">{errorMessage}</span>
        )}
      </div>
    </form>
  );
}
