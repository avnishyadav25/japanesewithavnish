"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminCard } from "@/components/admin/AdminCard";
import { GenerateContentButton } from "@/components/admin/GenerateContentButton";

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
  const [form, setForm] = useState({
    slug: item?.slug ?? "",
    title: item?.title ?? "",
    content: item?.content ?? "",
    jlpt_level: item?.jlpt_level ?? "",
    tags: item?.tags?.join(", ") ?? "",
    status: item?.status ?? "draft",
    sort_order: item?.sort_order ?? 0,
  });

  function update<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const url = item
        ? `/api/admin/learning-content/${contentType}/${item.slug}`
        : `/api/admin/learning-content/${contentType}`;
      const res = await fetch(url, {
        method: item ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: form.slug,
          title: form.title,
          content: form.content,
          jlpt_level: form.jlpt_level || null,
          tags: form.tags ? form.tags.split(",").map((s) => s.trim()).filter(Boolean) : [],
          status: form.status,
          sort_order: form.sort_order,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      router.push(`/admin/learn/${contentType}`);
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
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-charcoal">Content</label>
              <GenerateContentButton
                contentType={contentType as "grammar" | "vocabulary" | "kanji" | "reading" | "listening" | "writing"}
                context={{
                  jlptLevel: form.jlpt_level || undefined,
                  topic: form.title,
                  tags: form.tags,
                  description: form.content?.slice(0, 200) || undefined,
                }}
                onGenerated={(data) => update("content", typeof data === "string" ? data : data.content ?? "")}
              />
            </div>
            <textarea
              value={form.content}
              onChange={(e) => update("content", e.target.value)}
              rows={10}
              className="w-full px-4 py-2 border border-[var(--divider)] rounded-bento text-charcoal font-mono text-sm"
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
        </div>
      </AdminCard>

      <div className="flex items-center gap-4">
        <button type="submit" className="btn-primary" disabled={status === "loading"}>
          {status === "loading" ? "Saving..." : "Save"}
        </button>
        {status === "error" && (
          <span className="text-red-600 text-sm">Failed to save.</span>
        )}
      </div>
    </form>
  );
}
