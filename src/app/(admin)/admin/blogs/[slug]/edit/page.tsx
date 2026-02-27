import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { BlogPostForm } from "../../BlogPostForm";

export default async function AdminBlogsEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createAdminClient();
  const { data: post, error } = await supabase
    .from("posts")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !post) notFound();

  return (
    <div>
      <AdminPageHeader
        title="Edit post"
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Blogs", href: "/admin/blogs" },
          { label: post.title },
        ]}
      />
      <BlogPostForm post={post} />
    </div>
  );
}
