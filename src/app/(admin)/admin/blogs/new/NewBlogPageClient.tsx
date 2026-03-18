"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LEARN_CONTENT_TYPES, LEARN_TYPE_LABELS, type LearnContentType } from "@/lib/learn-filters";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { BlogPostForm } from "../BlogPostForm";
import { LearningContentForm } from "../../learn/LearningContentForm";
import { BLOG_PREFILL_KEY, LEARN_PREFILL_KEY } from "@/components/admin/NewPostModal";

export function NewBlogPageClient() {
  const searchParams = useSearchParams();
  const contentTypeParam = searchParams?.get("content_type") ?? "";
  const contentType = contentTypeParam.toLowerCase();
  const isLearnType = contentType && LEARN_CONTENT_TYPES.includes(contentType as LearnContentType);

  const [blogPrefill, setBlogPrefill] = useState<Parameters<typeof BlogPostForm>[0]["post"] | null>(null);
  const [learnPrefill, setLearnPrefill] = useState<{ contentType: string; item: { title?: string; slug?: string; meta?: Record<string, unknown>; jlpt_level?: string | null } } | null>(null);

  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    try {
      const blogRaw = sessionStorage.getItem(BLOG_PREFILL_KEY);
      if (blogRaw) {
        sessionStorage.removeItem(BLOG_PREFILL_KEY);
        const parsed = JSON.parse(blogRaw) as Record<string, unknown>;
        setBlogPrefill({
          slug: String(parsed.slug ?? ""),
          title: String(parsed.title ?? ""),
          summary: String(parsed.summary ?? ""),
          content: String(parsed.content ?? ""),
          jlpt_level: Array.isArray(parsed.jlpt_level) ? (parsed.jlpt_level as string[]) : parsed.jlpt_level ? [String(parsed.jlpt_level)] : null,
          tags: Array.isArray(parsed.tags) ? (parsed.tags as string[]) : null,
          status: "draft",
          published_at: null,
          seo_title: String(parsed.seo_title ?? ""),
          seo_description: String(parsed.seo_description ?? ""),
          og_image_url: parsed.og_image_url != null ? String(parsed.og_image_url) : null,
          image_prompt: parsed.image_prompt != null ? String(parsed.image_prompt) : null,
        });
      }
      const learnRaw = sessionStorage.getItem(LEARN_PREFILL_KEY);
      if (learnRaw) {
        sessionStorage.removeItem(LEARN_PREFILL_KEY);
        const parsed = JSON.parse(learnRaw) as { contentType?: string; item?: Record<string, unknown> };
        if (parsed.contentType && parsed.item) {
          setLearnPrefill({
            contentType: parsed.contentType,
            item: {
              title: parsed.item.title != null ? String(parsed.item.title) : "",
              slug: parsed.item.slug != null ? String(parsed.item.slug) : "",
              meta: parsed.item.meta != null && typeof parsed.item.meta === "object" ? (parsed.item.meta as Record<string, unknown>) : {},
              jlpt_level: parsed.item.jlpt_level != null ? String(parsed.item.jlpt_level) : null,
            },
          });
        }
      }
    } catch {
      // ignore
    }
  }, []);

  if (isLearnType) {
    const item = learnPrefill?.contentType === contentType ? learnPrefill.item : null;
    const initialItem = item
      ? {
          id: "",
          slug: item.slug ?? "",
          title: item.title ?? "",
          content: null,
          jlpt_level: item.jlpt_level ?? null,
          tags: null,
          meta: item.meta ?? {},
          status: "draft",
          sort_order: 0,
        }
      : undefined;

    return (
      <div>
        <AdminPageHeader
          title={`New ${LEARN_TYPE_LABELS[contentType as LearnContentType]}`}
          breadcrumb={[
            { label: "Admin", href: "/admin" },
            { label: "Blogs", href: "/admin/blogs" },
          ]}
        />
        <LearningContentForm contentType={contentType} item={initialItem} editBasePath="blogs" />
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="New post"
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Blogs", href: "/admin/blogs" },
        ]}
      />
      <BlogPostForm post={blogPrefill ?? undefined} />
    </div>
  );
}
