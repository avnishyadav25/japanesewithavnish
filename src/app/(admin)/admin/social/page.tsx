import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { sql } from "@/lib/db";
import { listBriefs } from "@/lib/social/briefs";
import { ImportPackButton } from "./ImportPackButton";

export const dynamic = "force-dynamic";

type SocialPackRow = {
  id: string;
  entity_type: string;
  entity_id: string | null;
  slug: string;
  title: string;
  image_urls: Record<string, string> | null;
  created_at: string;
};

/**
 * Briefs from the new per-surface engine, above the legacy packs.
 *
 * Both are listed during the transition: existing packs keep working and stay reachable, while
 * everything new is a brief. Nothing is migrated implicitly — a pack becomes a brief only when
 * someone deliberately imports it.
 */
async function BriefsSection() {
  if (!sql) return null;
  const briefs = await listBriefs(25);
  if (briefs.length === 0) return null;

  return (
    <>
      <h2 className="font-heading text-lg font-bold text-charcoal mb-3">Briefs</h2>
      <AdminCard className="mb-8">
        <AdminTable headers={["Created", "Title", "Source", "Surfaces", "Posted", "Status"]}>
          {briefs.map((b) => (
            <tr key={b.id}>
              <td className="py-3 px-2 text-secondary whitespace-nowrap">
                {new Date(b.createdAt).toLocaleDateString()}
              </td>
              <td className="py-3 px-2">
                <Link href={`/admin/social/briefs/${b.id}`} className="text-primary hover:underline">
                  {b.title}
                </Link>
              </td>
              <td className="py-3 px-2 text-secondary">{b.sourceType.replace(/_/g, " ")}</td>
              <td className="py-3 px-2 text-charcoal tabular-nums">{b.variantCount}</td>
              <td className="py-3 px-2 tabular-nums">
                {b.postedCount > 0 ? (
                  <span className="text-charcoal">{b.postedCount}</span>
                ) : (
                  <span className="text-secondary">—</span>
                )}
              </td>
              <td className="py-3 px-2">
                <StatusBadge status={b.status} />
              </td>
            </tr>
          ))}
        </AdminTable>
      </AdminCard>
    </>
  );
}

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
          title="Social"
          breadcrumb={[{ label: "Admin", href: "/admin" }]}
          actions={[{ label: "Prepare for social", href: "/admin/social/prepare" }]}
        />
        <BriefsSection />
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
        title="Social"
        breadcrumb={[{ label: "Admin", href: "/admin" }]}
        actions={[{ label: "Prepare for social", href: "/admin/social/prepare" }]}
      />
      <BriefsSection />
      <h2 className="font-heading text-lg font-bold text-charcoal mb-3">Content packs</h2>
      <p className="text-secondary text-sm mb-4">
        Packs from the original single-call generator. Still editable; new work goes through briefs above.
      </p>
      <AdminCard>
        <AdminTable headers={["Created", "Type", "Title", "Slug", "Images", "Actions"]}>
          {packs.map((p) => {
            const images = p.image_urls ? Object.keys(p.image_urls).length : 0;
            const created = new Date(p.created_at);
            const prepareHref = `/admin/social/prepare?type=${encodeURIComponent(
              p.entity_type
            )}&slug=${encodeURIComponent(p.slug)}`;
            return (
              <tr key={p.id} className="border-b border-[var(--divider)] hover:bg-[var(--base)] transition-colors">
                <td className="py-2 px-2 text-secondary text-xs">
                  {Number.isNaN(created.getTime()) ? "—" : created.toLocaleString()}
                </td>
                <td className="py-2 px-2 capitalize text-secondary">{p.entity_type}</td>
                <td className="py-2 px-2 font-medium text-charcoal max-w-xs">
                  <span className="line-clamp-1">{p.title}</span>
                </td>
                <td className="py-2 px-2 text-secondary text-xs max-w-xs">
                  <span className="line-clamp-1">{p.slug}</span>
                </td>
                <td className="py-2 px-2 text-secondary text-xs">{images || "—"}</td>
                <td className="py-2 px-2 whitespace-nowrap text-sm">
                  <ImportPackButton packId={p.id} />
                  <span className="mx-2 text-secondary opacity-40">·</span>
                  <a href={prepareHref} className="text-secondary hover:underline">
                    Open in Prepare
                  </a>
                </td>
              </tr>
            );
          })}
        </AdminTable>
      </AdminCard>
    </div>
  );
}

