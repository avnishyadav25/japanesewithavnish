import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { LEARN_CONTENT_TYPES, LEARN_TYPE_LABELS, type LearnContentType } from "@/lib/learn-filters";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { GenerateLearnListButton } from "@/components/admin/GenerateLearnListButton";
import { LearnContentRowActions } from "@/components/admin/LearnContentRowActions";

export default async function AdminLearnPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ level?: string; view?: string }>;
}) {
  const { type } = await params;
  const { level = "all", view = "table" } = await searchParams;
  
  const normalized = type.toLowerCase();
  if (!LEARN_CONTENT_TYPES.includes(normalized as LearnContentType)) notFound();

  const selectedLevel = level.toUpperCase();
  const selectedView = view.toLowerCase();

  type Row = {
    id: string;
    slug: string;
    title: string;
    jlpt_level: string | null;
    status: string;
    sort_order: number;
    meta: Record<string, unknown> | null;
    og_image_url?: string | null;
  };

  let items: Row[] = [];
  if (sql) {
    if (selectedLevel === "ALL") {
      const rows = await sql`
        SELECT id, slug, title, (jlpt_level)[1] AS jlpt_level, status, sort_order, meta, og_image_url
        FROM posts WHERE content_type = ${normalized}
        ORDER BY sort_order, created_at DESC
      `;
      items = (rows ?? []) as Row[];
    } else {
      const rows = await sql`
        SELECT id, slug, title, (jlpt_level)[1] AS jlpt_level, status, sort_order, meta, og_image_url
        FROM posts WHERE content_type = ${normalized} AND (jlpt_level)[1] = ${selectedLevel}
        ORDER BY sort_order, created_at DESC
      `;
      items = (rows ?? []) as Row[];
    }
  }

  const featureImageUrl = (item: Row) =>
    item.og_image_url ?? (item.meta && typeof item.meta.feature_image_url === "string" ? item.meta.feature_image_url : null);

  const levels = ["ALL", "N5", "N4", "N3", "N2", "N1"];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={LEARN_TYPE_LABELS[normalized as LearnContentType]}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Learning" },
        ]}
        action={{ label: "Add Item", href: `/admin/learn/${normalized}/new` }}
      />

      {/* Level filter tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--divider)] pb-4">
        <div className="flex flex-wrap gap-2">
          {levels.map((lvl) => {
            const active = selectedLevel === lvl;
            const linkParams = new URLSearchParams();
            if (lvl !== "ALL") linkParams.set("level", lvl.toLowerCase());
            if (selectedView !== "table") linkParams.set("view", selectedView);
            const href = `/admin/learn/${normalized}?${linkParams.toString()}`;

            return (
              <Link
                key={lvl}
                href={href}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition border ${
                  active
                    ? "bg-[#D0021B] border-[#D0021B] text-white"
                    : "bg-white border-[#EEEEEE] hover:border-primary/40 text-charcoal"
                }`}
              >
                {lvl}
              </Link>
            );
          })}
        </div>

        {/* View toggles */}
        <div className="flex items-center gap-1 bg-white border border-[#EEEEEE] p-1 rounded-lg">
          {["table", "gallery", "list"].map((v) => {
            const active = selectedView === v;
            const linkParams = new URLSearchParams();
            if (selectedLevel !== "ALL") linkParams.set("level", selectedLevel.toLowerCase());
            linkParams.set("view", v);
            const href = `/admin/learn/${normalized}?${linkParams.toString()}`;

            return (
              <Link
                key={v}
                href={href}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition ${
                  active ? "bg-primary/10 text-primary" : "text-secondary hover:text-charcoal"
                }`}
              >
                {v}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mb-4">
        <GenerateLearnListButton
          contentType={normalized}
          existingItems={items.map((i) => ({ slug: i.slug, title: i.title }))}
        />
      </div>

      {items.length > 0 ? (
        <>
          {selectedView === "table" && (
            <AdminCard>
              <AdminTable headers={["Image", "Title", "JLPT", "Status", "Actions"]}>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--divider)]">
                    <td className="py-2 px-2">
                      {featureImageUrl(item) ? (
                        <div className="w-10 h-10 rounded overflow-hidden border border-[var(--divider)] bg-[var(--divider)]/20 flex-shrink-0">
                          <img src={featureImageUrl(item)!} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <span className="text-secondary text-xs">—</span>
                      )}
                    </td>
                    <td className="py-2 px-2 font-medium text-charcoal">{item.title}</td>
                    <td className="py-2 px-2 text-secondary text-sm">{item.jlpt_level ?? "—"}</td>
                    <td className="py-2 px-2">
                      <StatusBadge
                        status={item.status}
                        variant={item.status === "published" ? "published" : "draft"}
                      />
                    </td>
                    <td className="py-2 px-2">
                      <LearnContentRowActions contentType={normalized} slug={item.slug} status={item.status} />
                    </td>
                  </tr>
                ))}
              </AdminTable>
            </AdminCard>
          )}

          {selectedView === "gallery" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map((item) => {
                const img = featureImageUrl(item);
                return (
                  <div key={item.id} className="card bg-white border border-[#EEEEEE] p-4 rounded-xl flex flex-col justify-between hover:shadow-md transition">
                    <div>
                      {img ? (
                        <div className="aspect-[16/9] w-full rounded-lg overflow-hidden mb-3 border border-[var(--divider)] bg-[var(--divider)]/10">
                          <img src={img} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="aspect-[16/9] w-full rounded-lg bg-gradient-to-br from-primary/10 to-primary/30 flex items-center justify-center text-primary font-bold text-lg mb-3">
                          {item.title.slice(0, 3)}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold text-secondary bg-base px-2 py-0.5 rounded border border-[var(--divider)]">
                          {item.jlpt_level ?? "ALL"}
                        </span>
                        <StatusBadge
                          status={item.status}
                          variant={item.status === "published" ? "published" : "draft"}
                        />
                      </div>
                      <h3 className="font-bold text-charcoal text-sm truncate">{item.title}</h3>
                      <p className="text-secondary text-xs mt-1 truncate">
                        {String(item.meta?.summary ?? item.meta?.meaning ?? "Learn Japanese")}
                      </p>
                    </div>
                    <div className="mt-4 border-t border-[var(--divider)] pt-3 flex items-center justify-end">
                      <LearnContentRowActions contentType={normalized} slug={item.slug} status={item.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {selectedView === "list" && (
            <div className="space-y-3">
              {items.map((item) => {
                const img = featureImageUrl(item);
                return (
                  <div key={item.id} className="card bg-white border border-[#EEEEEE] p-4 rounded-xl flex flex-col sm:flex-row items-center gap-4 hover:shadow-sm transition">
                    {img ? (
                      <div className="w-16 h-16 rounded-lg overflow-hidden border border-[var(--divider)] bg-[var(--divider)]/10 flex-shrink-0">
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary/10 to-primary/30 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                        {item.title.slice(0, 2)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-secondary bg-base px-1.5 py-0.5 rounded border border-[var(--divider)]">
                          {item.jlpt_level ?? "ALL"}
                        </span>
                        <StatusBadge
                          status={item.status}
                          variant={item.status === "published" ? "published" : "draft"}
                        />
                      </div>
                      <h3 className="font-bold text-charcoal text-sm truncate">{item.title}</h3>
                      <p className="text-secondary text-xs truncate mt-0.5">
                        {String(item.meta?.summary ?? item.meta?.meaning ?? "Learn Japanese")}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <LearnContentRowActions contentType={normalized} slug={item.slug} status={item.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <AdminEmptyState
          message={`No ${LEARN_TYPE_LABELS[normalized as LearnContentType].toLowerCase()} content yet.`}
          action={{ label: "Add Item", href: `/admin/learn/${normalized}/new` }}
        />
      )}
    </div>
  );
}
