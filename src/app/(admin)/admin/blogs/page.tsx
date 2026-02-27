import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { BlogListClient } from "./BlogListClient";

export default async function AdminBlogsPage() {
  const supabase = createAdminClient();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [{ data: posts }, { count: thisMonth }] = await Promise.all([
    supabase
      .from("posts")
      .select("id, slug, title, status, published_at, jlpt_level, og_image_url, summary")
      .order("created_at", { ascending: false }),
    supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .gte("published_at", monthStart),
  ]);

  const total = posts?.length ?? 0;
  const published = posts?.filter((p) => p.status === "published").length ?? 0;
  const draft = total - published;

  if (!posts || posts.length === 0) {
    return (
      <div>
        <AdminPageHeader
          title="Blogs"
          breadcrumb={[{ label: "Admin", href: "/admin" }]}
          action={{ label: "New post", href: "/admin/blogs/new" }}
        />
        <AdminEmptyState
          message="No posts yet."
          action={{ label: "New post", href: "/admin/blogs/new" }}
        />
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Blogs"
        breadcrumb={[{ label: "Admin", href: "/admin" }]}
        action={{ label: "New post", href: "/admin/blogs/new" }}
      />
      <BlogListClient
        posts={posts}
        stats={{ total, published, draft, thisMonth: thisMonth ?? 0 }}
      />
    </div>
  );
}
