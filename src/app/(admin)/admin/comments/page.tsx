import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";

export default async function AdminCommentsPage() {
  const supabase = createAdminClient();
  const { data: comments } = await supabase
    .from("post_comments")
    .select("id, author_name, author_email, content, status, created_at, post_id")
    .order("created_at", { ascending: false })
    .limit(200);

  const items = comments || [];
  const postIds = Array.from(new Set(items.map((c) => c.post_id)));
  const { data: posts } =
    postIds.length > 0
      ? await supabase.from("posts").select("id, title, slug").in("id", postIds)
      : { data: [] };
  const postMap = new Map((posts || []).map((p) => [p.id, p]));

  return (
    <div>
      <AdminPageHeader
        title="All comments"
        breadcrumb={[{ label: "Admin", href: "/admin" }]}
      />
      <div className="mb-6">
        <div className="card-content bento-span-2 inline-block w-fit">
          <p className="text-secondary text-sm uppercase tracking-wider">Total</p>
          <p className="font-heading text-2xl font-bold text-charcoal">
            {items.length}
          </p>
        </div>
      </div>
      {items.length > 0 ? (
        <AdminCard>
          <AdminTable headers={["Name", "Email", "Comment", "Blog", "Status", "Date", "Actions"]}>
            {items.map((c) => {
              const post = postMap.get(c.post_id);
              const postTitle = post?.title ?? "—";
              const postSlug = post?.slug ?? "";
              return (
                <tr key={c.id} className="border-b border-[var(--divider)]">
                  <td className="py-2 px-2 font-medium text-charcoal">
                    {c.author_name}
                  </td>
                  <td className="py-2 px-2 text-secondary text-sm">
                    {c.author_email}
                  </td>
                  <td className="py-2 px-2 text-charcoal max-w-[280px]">
                    <span className="line-clamp-2 block" title={c.content}>
                      {c.content}
                    </span>
                  </td>
                  <td className="py-2 px-2">
                    {postSlug ? (
                      <Link
                        href={`/admin/blogs/${postSlug}/comments`}
                        className="text-primary text-sm hover:underline"
                      >
                        {postTitle}
                      </Link>
                    ) : (
                      postTitle
                    )}
                  </td>
                  <td className="py-2 px-2">
                    <StatusBadge
                      status={c.status}
                      variant={c.status === "approved" ? "published" : "draft"}
                    />
                  </td>
                  <td className="py-2 px-2 text-secondary text-xs">
                    {new Date(c.created_at).toLocaleString()}
                  </td>
                  <td className="py-2 px-2">
                    {postSlug && (
                      <Link
                        href={`/admin/blogs/${postSlug}/comments`}
                        className="text-primary text-sm hover:underline"
                      >
                        Manage
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </AdminTable>
        </AdminCard>
      ) : (
        <AdminEmptyState message="No comments yet." />
      )}
    </div>
  );
}
