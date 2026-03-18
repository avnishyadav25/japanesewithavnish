"use client";

import Link from "next/link";
import { useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { NewPostModal } from "@/components/admin/NewPostModal";
import { GenerateListModal } from "@/components/admin/GenerateListModal";
import { BlogListClient } from "./BlogListClient";

type PostRow = { id: string; slug: string; title: string; status: string; published_at: string | null; jlpt_level: string | string[] | null; og_image_url: string | null; summary: string | null; content_type: string | null; created_at: string; updated_at: string };

export function AdminBlogsPageClient({
  posts,
  stats,
  blogViews = 0,
  blogAvgSeconds = null,
}: {
  posts: PostRow[];
  stats: { total: number; published: number; draft: number; thisMonth: number };
  blogViews?: number;
  blogAvgSeconds?: number | null;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [generateListOpen, setGenerateListOpen] = useState(false);
  const openNew = () => setModalOpen(true);

  if (posts.length === 0) {
    return (
      <div>
        <AdminPageHeader
          title="Blogs"
          breadcrumb={[{ label: "Admin", href: "/admin" }]}
          action={{ label: "New post", onClick: openNew }}
        />
        <AdminEmptyState
          message="No posts yet."
          action={{ label: "New post", onClick: openNew }}
        />
        <NewPostModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </div>
    );
  }

  return (
    <div>
        <AdminPageHeader
        title="Blogs"
        breadcrumb={[{ label: "Admin", href: "/admin" }]}
        actions={[
          { label: "Prepare for social", href: "/admin/social/prepare" },
          { label: "Generate AI list", onClick: () => setGenerateListOpen(true) },
          { label: "New post", onClick: openNew },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <p className="text-sm text-secondary">
          <a href="/admin/ai-logs?entityType=post" className="text-primary hover:underline">
            AI history
          </a>{" "}
          (content &amp; image generations for posts)
        </p>
        <p className="text-sm text-secondary">
          <Link href="/admin/analytics" className="text-primary hover:underline">
            Content analytics
          </Link>
          {blogViews > 0 && (
            <>
              {" "}
              — {blogViews} views
              {blogAvgSeconds != null && blogAvgSeconds > 0 ? `, avg ${blogAvgSeconds}s per session` : ""}
            </>
          )}
        </p>
      </div>
      <BlogListClient posts={posts} stats={stats} />
      <NewPostModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <GenerateListModal open={generateListOpen} onClose={() => setGenerateListOpen(false)} posts={posts} />
    </div>
  );
}
