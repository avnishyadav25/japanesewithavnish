import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

export default async function AdminBlogsPage() {
  const supabase = createAdminClient();
  const { data: posts } = await supabase
    .from("posts")
    .select("id, slug, title, status, published_at, jlpt_level")
    .order("created_at", { ascending: false });

  return (
    <div>
      <AdminPageHeader
        title="Blogs"
        breadcrumb={[{ label: "Admin", href: "/admin" }]}
        action={{ label: "New post", href: "/admin/blogs/new" }}
      />
      {posts && posts.length > 0 ? (
        <AdminCard>
          <AdminTable headers={["Title", "Status", "JLPT", "Published", "Actions"]}>
            {posts.map((p) => (
              <tr key={p.id} className="border-b border-[var(--divider)]">
                <td className="py-2 px-2 font-medium text-charcoal">{p.title}</td>
                <td className="py-2 px-2">
                  <StatusBadge
                    status={p.status}
                    variant={p.status === "published" ? "published" : "draft"}
                  />
                </td>
                <td className="py-2 px-2 text-secondary text-xs">
                  {Array.isArray(p.jlpt_level) ? p.jlpt_level.join(", ") : p.jlpt_level ?? "—"}
                </td>
                <td className="py-2 px-2 text-secondary text-xs">
                  {p.published_at
                    ? new Date(p.published_at).toLocaleDateString()
                    : "—"}
                </td>
                <td className="py-2 px-2">
                  <Link
                    href={`/admin/blogs/${p.slug}/edit`}
                    className="text-primary text-sm hover:underline mr-3"
                  >
                    Edit
                  </Link>
                  <Link
                    href={`/admin/blogs/${p.slug}/comments`}
                    className="text-primary text-sm hover:underline mr-3"
                  >
                    Comments
                  </Link>
                  {p.status === "published" && (
                    <Link
                      href={`/blog/${p.slug}`}
                      className="text-primary text-sm hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      ) : (
        <AdminEmptyState
          message="No posts yet."
          action={{ label: "New post", href: "/admin/blogs/new" }}
        />
      )}
    </div>
  );
}
