import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { BlogPostForm } from "../BlogPostForm";

export default function AdminBlogsNewPage() {
  return (
    <div>
      <AdminPageHeader
        title="New post"
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Blogs", href: "/admin/blogs" },
        ]}
      />
      <BlogPostForm />
    </div>
  );
}
