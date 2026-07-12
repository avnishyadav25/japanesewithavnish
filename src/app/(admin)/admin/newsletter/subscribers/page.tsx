import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

type Subscriber = { email: string; name: string | null; source: string | null; created_at: string };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function param(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminNewsletterSubscribersPage({ searchParams }: { searchParams?: SearchParams }) {
  const params = searchParams ? await searchParams : {};
  const q = (param(params.q) || "").trim();
  const source = (param(params.source) || "").trim();
  const page = Math.max(1, Number(param(params.page) || "1") || 1);
  const limit = 50;
  const offset = (page - 1) * limit;
  let total = 0;
  let subscribers: Subscriber[] = [];
  let sourceRows: { source: string | null; count: number }[] = [];
  const like = `%${q.toLowerCase()}%`;

  if (sql) {
    try {
      const countRows = await sql`
        SELECT COUNT(*)::int AS c
        FROM subscribers
        WHERE (${q || null}::text IS NULL OR LOWER(email) LIKE ${like} OR LOWER(COALESCE(name, '')) LIKE ${like})
          AND (${source || null}::text IS NULL OR source = ${source})
      ` as { c: number }[];
      const subRows = await sql`
        SELECT email, name, source, created_at
        FROM subscribers
        WHERE (${q || null}::text IS NULL OR LOWER(email) LIKE ${like} OR LOWER(COALESCE(name, '')) LIKE ${like})
          AND (${source || null}::text IS NULL OR source = ${source})
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      ` as Subscriber[];
      const breakdownRows = await sql`
        SELECT COALESCE(source, 'unknown') AS source, COUNT(*)::int AS count
        FROM subscribers
        GROUP BY source
        ORDER BY count DESC
      ` as { source: string | null; count: number }[];
      total = Number(countRows[0]?.c ?? 0);
      subscribers = subRows ?? [];
      sourceRows = breakdownRows ?? [];
    } catch (error) {
      console.error("Admin newsletter subscribers:", error);
    }
  }

  const csv =
    "email,name,source,created_at\n" +
    subscribers.map((s) => `${s.email},${s.name || ""},${s.source || ""},${s.created_at}`).join("\n");

  return (
    <div>
      <AdminPageHeader
        title="Newsletter Subscribers"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Newsletter" }]}
        actions={[
          { label: "Notifications", href: "/admin/newsletter/notifications" },
          { label: "New Newsletter", href: "/admin/newsletters/new" },
        ]}
      />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4 mb-6">
        <AdminCard>
          <p className="text-secondary text-sm uppercase tracking-wider">Matching subscribers</p>
          <p className="font-heading text-3xl font-bold text-charcoal">{total}</p>
          <p className="text-xs text-secondary mt-2">Showing page {page} of {Math.max(1, Math.ceil(total / limit))}</p>
        </AdminCard>
        <AdminCard>
          <form className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-3">
            <input name="q" defaultValue={q} placeholder="Search email or name" className="px-3 py-2 border border-[var(--divider)] rounded-bento bg-white" />
            <select name="source" defaultValue={source} className="px-3 py-2 border border-[var(--divider)] rounded-bento bg-white">
              <option value="">All sources</option>
              {sourceRows.map((row) => (
                <option key={row.source || "unknown"} value={row.source || ""}>{row.source || "unknown"} ({row.count})</option>
              ))}
            </select>
            <button className="btn-primary" type="submit">Filter</button>
          </form>
        </AdminCard>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="text-sm text-secondary">
          Sources: {sourceRows.length ? sourceRows.map((row) => `${row.source || "unknown"} ${row.count}`).join(" / ") : "none"}
        </div>
        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`}
          download="subscribers.csv"
          className="btn-secondary inline-block"
        >
          Export current page CSV
        </a>
      </div>
      {subscribers.length > 0 ? (
        <AdminCard>
          <AdminTable headers={["Email", "Name", "Source", "Date"]}>
            {subscribers.map((s, i) => (
              <tr key={i} className="border-b border-[var(--divider)]">
                <td className="py-2 px-2">{s.email}</td>
                <td className="py-2 px-2 text-secondary">{s.name || "—"}</td>
                <td className="py-2 px-2 text-secondary">{s.source || "—"}</td>
                <td className="py-2 px-2 text-secondary text-xs">
                  {new Date(s.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      ) : (
        <AdminEmptyState message="No subscribers yet." />
      )}
      <div className="flex items-center justify-between mt-4 text-sm">
        <a className={page <= 1 ? "pointer-events-none opacity-50" : "text-primary hover:underline"} href={`/admin/newsletter/subscribers?q=${encodeURIComponent(q)}&source=${encodeURIComponent(source)}&page=${page - 1}`}>Previous</a>
        <a className={offset + subscribers.length >= total ? "pointer-events-none opacity-50" : "text-primary hover:underline"} href={`/admin/newsletter/subscribers?q=${encodeURIComponent(q)}&source=${encodeURIComponent(source)}&page=${page + 1}`}>Next</a>
      </div>
    </div>
  );
}
