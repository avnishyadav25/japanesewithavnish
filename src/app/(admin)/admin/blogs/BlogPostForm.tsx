"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminCard } from "@/components/admin/AdminCard";
import { GenerateContentButton } from "@/components/admin/GenerateContentButton";
import { GenerateImageModal } from "@/components/admin/GenerateImageModal";
import { BlogPreviewModal } from "@/components/admin/BlogPreviewModal";
import { SectionImageGenerator } from "@/components/admin/SectionImageGenerator";

/** Extract markdown images ![alt](url) from content for display. */
function extractMarkdownImages(content: string): { alt: string; url: string }[] {
  const re = /!\[([^\]]*)\]\(\s*([^)\s]+)\s*\)/g;
  const out: { alt: string; url: string }[] = [];
  let m;
  while ((m = re.exec(content)) !== null) {
    const url = (m[2] || "").trim();
    if (url && (url.startsWith("http://") || url.startsWith("https://")))
      out.push({ alt: (m[1] || "").trim() || "Image", url });
  }
  return out;
}

type Post = {
  id?: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  jlpt_level: string[] | null;
  tags: string[] | null;
  status: string;
  published_at: string | null;
  seo_title: string;
  seo_description: string;
  og_image_url: string | null;
  image_prompt?: string | null;
};

export function BlogPostForm({ post }: { post?: Post }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [form, setForm] = useState({
    slug: post?.slug ?? "",
    title: post?.title ?? "",
    summary: post?.summary ?? "",
    content: post?.content ?? "",
    jlpt_level: post?.jlpt_level?.join(", ") ?? "",
    tags: post?.tags?.join(", ") ?? "",
    status: post?.status ?? "draft",
    published_at: post?.published_at
      ? new Date(post.published_at).toISOString().slice(0, 16)
      : "",
    seo_title: post?.seo_title ?? "",
    seo_description: post?.seo_description ?? "",
    og_image_url: post?.og_image_url ?? "",
    image_prompt: post?.image_prompt ?? "",
    section_image_prompts: [] as { placeholder: string; section: string; prompt: string }[],
  });

  function update<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMessage(null);
    try {
      const res = await fetch(
        post ? `/api/admin/posts/${post.slug}` : "/api/admin/posts",
        {
          method: post ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: form.slug,
            title: form.title,
            summary: form.summary,
            content: form.content,
            jlpt_level: form.jlpt_level
              ? form.jlpt_level.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)
              : [],
            tags: form.tags ? form.tags.split(",").map((s) => s.trim()).filter(Boolean) : [],
            status: form.status,
            published_at: form.published_at || null,
            seo_title: form.seo_title,
            seo_description: form.seo_description,
            og_image_url: form.og_image_url || null,
            image_prompt: form.image_prompt || null,
          }),
        }
      );
      if (!res.ok) {
        let msg = "Failed to save blog post";
        try {
          const data = (await res.json()) as { error?: string };
          if (data?.error) msg = data.error;
        } catch {
          // ignore parse error
        }
        setErrorMessage(msg);
        throw new Error(msg);
      }
      router.push("/admin/blogs");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  return (
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
              placeholder="my-post-slug"
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
              <label className="block text-sm font-medium text-charcoal">Summary</label>
              <button
                type="button"
                disabled={summaryLoading || !form.slug || !form.content}
                onClick={async () => {
                  setSummaryLoading(true);
                  try {
                    const res = await fetch("/api/ai/blog-summary", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ slug: form.slug }),
                    });
                    const data = await res.json();
                    if (data.error) throw new Error(data.error);
                    if (typeof data.summary === "string") update("summary", data.summary);
                  } catch {
                    // no-op; could add toast
                  } finally {
                    setSummaryLoading(false);
                  }
                }}
                className="text-sm text-primary hover:underline disabled:opacity-50 disabled:pointer-events-none"
              >
                {summaryLoading ? "Generating…" : "Create summary (AI)"}
              </button>
            </div>
            <textarea
              value={form.summary}
              onChange={(e) => update("summary", e.target.value)}
              rows={2}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
              <label className="block text-sm font-medium text-charcoal">Content</label>
              <div className="flex gap-2">
                <GenerateContentButton
                contentType="blog"
                context={{
                  topic: form.title,
                  jlptLevel: form.jlpt_level?.split(",")[0]?.trim(),
                  tags: form.tags,
                  description: form.summary,
                }}
                onGenerated={(data) => {
                  if (typeof data === "string") {
                    update("content", data);
                    return;
                  }
                  const d = data as {
                    content?: string;
                    title?: string;
                    slug?: string;
                    tags?: string;
                    jlpt_level?: string;
                    seo_title?: string;
                    seo_description?: string;
                    image_prompt?: string;
                    section_image_prompts?: { placeholder: string; section: string; prompt: string }[];
                  };
                  if (d.content) update("content", d.content);
                  if (d.title) update("title", d.title);
                  if (d.slug && !form.slug) update("slug", d.slug);
                  if (d.tags) update("tags", d.tags);
                  if (d.jlpt_level) update("jlpt_level", d.jlpt_level);
                  if (d.seo_title) update("seo_title", d.seo_title);
                  if (d.seo_description) update("seo_description", d.seo_description);
                  if (d.image_prompt) update("image_prompt", d.image_prompt);
                  if (d.section_image_prompts?.length)
                    update("section_image_prompts", d.section_image_prompts);
                }}
              />
              </div>
            </div>
            <textarea
              value={form.content}
              onChange={(e) => update("content", e.target.value)}
              rows={12}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal font-mono text-sm"
            />
            <SectionImageGenerator
              items={form.section_image_prompts}
              content={form.content}
              onContentUpdate={(c) => update("content", c)}
            />

            {/* All images in this post (featured + inline from content) */}
            {(form.og_image_url || extractMarkdownImages(form.content).length > 0) && (
              <div className="mt-4 p-4 border border-[var(--divider)] rounded-bento bg-[var(--base)]">
                <h3 className="text-sm font-semibold text-charcoal mb-3">All images in this post</h3>
                <div className="flex flex-wrap gap-3">
                  {form.og_image_url && (
                    <div className="flex flex-col items-start">
                      <span className="text-xs text-secondary mb-1">Feature image</span>
                      <div className="rounded overflow-hidden border border-[var(--divider)] w-32 aspect-video bg-[var(--divider)]/20">
                        <img src={form.og_image_url} alt="Feature" className="w-full h-full object-cover object-top" />
                      </div>
                    </div>
                  )}
                  {extractMarkdownImages(form.content).map((img, i) => (
                    <div key={`${img.url}-${i}`} className="flex flex-col items-start">
                      <span className="text-xs text-secondary mb-1">{img.alt || `Image ${i + 1}`}</span>
                      <div className="rounded overflow-hidden border border-[var(--divider)] w-32 aspect-video bg-[var(--divider)]/20">
                        <img src={img.url} alt={img.alt || ""} className="w-full h-full object-cover object-top" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">JLPT levels (comma)</label>
              <input
                type="text"
                value={form.jlpt_level}
                onChange={(e) => update("jlpt_level", e.target.value)}
                placeholder="N5, N4"
                className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Tags (comma)</label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => update("tags", e.target.value)}
                placeholder="grammar, vocabulary"
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
              <label className="block text-sm font-medium text-charcoal mb-1">Published at</label>
              <input
                type="datetime-local"
                value={form.published_at}
                onChange={(e) => update("published_at", e.target.value)}
                className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
              />
            </div>
          </div>
        </div>
      </AdminCard>

      <AdminCard>
        <h2 className="font-heading font-bold text-charcoal mb-4">SEO</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">SEO title</label>
            <input
              type="text"
              value={form.seo_title}
              onChange={(e) => update("seo_title", e.target.value)}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">SEO description</label>
            <textarea
              value={form.seo_description}
              onChange={(e) => update("seo_description", e.target.value)}
              rows={2}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal mb-1">Image prompt (for Generate image)</label>
            <textarea
              value={form.image_prompt}
              onChange={(e) => update("image_prompt", e.target.value)}
              placeholder="AI-generated or custom prompt for the feature image"
              rows={2}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal font-mono text-sm"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-charcoal">OG image URL (feature image)</label>
              <button
                type="button"
                onClick={() => setImageModalOpen(true)}
                className="text-sm text-primary hover:underline"
              >
                {form.og_image_url ? "Regenerate image" : "Generate image"}
              </button>
            </div>
            <input
              type="url"
              value={form.og_image_url}
              onChange={(e) => update("og_image_url", e.target.value)}
              placeholder="https://..."
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
            {form.og_image_url && (
              <div className="mt-2 rounded-bento overflow-hidden border border-[var(--divider)] bg-[var(--base)] max-w-xs">
                <img
                  src={form.og_image_url}
                  alt="Feature preview"
                  className="w-full aspect-video object-cover object-top"
                />
              </div>
            )}
            <GenerateImageModal
              open={imageModalOpen}
              onClose={() => setImageModalOpen(false)}
              imageType="blog"
              initialContext={{
                topic: form.title,
                title: form.title,
                jlptLevel: form.jlpt_level?.split(",")[0]?.trim(),
                tags: form.tags,
                description: form.summary,
              }}
              initialPrompt={form.image_prompt || undefined}
              onGenerated={(result) => {
                if (result.startsWith("http://") || result.startsWith("https://")) {
                  update("og_image_url", result);
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
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="btn-secondary"
        >
          Preview
        </button>
      </div>

      <BlogPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={form.title}
        content={form.content}
        publishedAt={form.published_at || undefined}
        ogImageUrl={form.og_image_url || undefined}
      />
    </form>
  );
}
