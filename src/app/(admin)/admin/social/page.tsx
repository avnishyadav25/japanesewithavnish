import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { sql } from "@/lib/db";

type SocialPackRow = {
  id: string;
  entity_type: string;
  entity_id: string | null;
  slug: string;
  title: string;
  image_urls: Record<string, string> | null;
  created_at: string;
};

export default async function AdminSocialListPage() {
  let packs: SocialPackRow[] = [];

  if (sql) {
    const rows = await sql`
      SELECT id, entity_type, entity_id, slug, title, image_urls, created_at
      FROM social_content_packs
      ORDER BY created_at DESC
      LIMIT 200
    `;
    packs = (rows ?? []) as SocialPackRow[];
  }

  if (packs.length === 0) {
    return (
      <div>
        <AdminPageHeader
          title="Social content packs"
          breadcrumb={[{ label: "Admin", href: "/admin" }]}
          actions={[{ label: "Prepare for social", href: "/admin/social/prepare" }]}
        />
        <AdminEmptyState
          message="No social content packs yet."
          action={{ label: "Prepare first pack", href: "/admin/social/prepare" }}
        />
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Social content packs"
        breadcrumb={[{ label: "Admin", href: "/admin" }]}
        actions={[{ label: "Prepare for social", href: "/admin/social/prepare" }]}
      />
      <p className="text-secondary text-sm mb-4">
        Latest AI-generated packs for blogs, products, and newsletters. Click through to refine or regenerate.
      </p>
      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--divider)] bg-[var(--base)]">
            <tr>
              <th className="py-3 px-3 text-left font-medium text-charcoal">Created</th>
              <th className="py-3 px-3 text-left font-medium text-charcoal">Type</th>
              <th className="py-3 px-3 text-left font-medium text-charcoal">Title</th>
              <th className="py-3 px-3 text-left font-medium text-charcoal">Slug</th>
              <th className="py-3 px-3 text-left font-medium text-charcoal">Images</th>
              <th className="py-3 px-3 text-left font-medium text-charcoal">Actions</th>
            </tr>
          </thead>
          <tbody>
            {packs.map((p) => {
              const images = p.image_urls ? Object.keys(p.image_urls).length : 0;
              const created = new Date(p.created_at);
              const prepareHref = `/admin/social/prepare?type=${encodeURIComponent(
                p.entity_type
              )}&slug=${encodeURIComponent(p.slug)}`;
              return (
                <tr key={p.id} className="border-b border-[var(--divider)] hover:bg-[var(--base)]">
                  <td className="py-2 px-3 text-secondary text-xs">
                    {Number.isNaN(created.getTime()) ? "—" : created.toLocaleString()}
                  </td>
                  <td className="py-2 px-3 capitalize text-secondary">{p.entity_type}</td>
                  <td className="py-2 px-3 font-medium text-charcoal max-w-xs">
                    <span className="line-clamp-1">{p.title}</span>
                  </td>
                  <td className="py-2 px-3 text-secondary text-xs max-w-xs">
                    <span className="line-clamp-1">{p.slug}</span>
                  </td>
                  <td className="py-2 px-3 text-secondary text-xs">{images || "—"}</td>
                  <td className="py-2 px-3">
                    <a
                      href={prepareHref}
                      className="text-primary text-sm hover:underline"
                    >
                      Open in Prepare
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

