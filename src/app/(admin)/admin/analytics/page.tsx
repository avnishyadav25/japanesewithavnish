import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

type Row = { content_type: string; content_id: string; views: number; durations: number; avg_seconds: number | null };

export default async function AdminAnalyticsPage() {
  let stats: Row[] = [];
  if (sql) {
    try {
      const rows = await sql`
        SELECT
          content_type,
          content_id,
          COUNT(*) FILTER (WHERE event_type = 'view') AS views,
          COUNT(*) FILTER (WHERE event_type = 'duration') AS durations,
          ROUND(AVG(duration_seconds) FILTER (WHERE event_type = 'duration'))::int AS avg_seconds
        FROM content_events
        GROUP BY content_type, content_id
        ORDER BY views DESC
        LIMIT 200
      ` as Row[];
      stats = rows ?? [];
    } catch {
      // Table may not exist
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Content analytics"
        breadcrumb={[{ label: "Admin", href: "/admin" }]}
      />
      <p className="text-secondary text-sm mb-6">Views and average time on content (blog posts, products).</p>
      {stats.length === 0 ? (
        <div className="card py-12 text-center text-secondary">No events yet. Views are recorded when visitors open blog or product pages.</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--divider)]">
              <tr>
                <th className="py-3 px-3 text-left font-medium text-charcoal">Type</th>
                <th className="py-3 px-3 text-left font-medium text-charcoal">Content ID</th>
                <th className="py-3 px-3 text-right font-medium text-charcoal">Views</th>
                <th className="py-3 px-3 text-right font-medium text-charcoal">Duration events</th>
                <th className="py-3 px-3 text-right font-medium text-charcoal">Avg (sec)</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={`${s.content_type}-${s.content_id}`} className="border-b border-[var(--divider)] hover:bg-[var(--base)]">
                  <td className="py-2 px-3">{s.content_type}</td>
                  <td className="py-2 px-3 font-mono text-xs">{s.content_id}</td>
                  <td className="py-2 px-3 text-right">{Number(s.views)}</td>
                  <td className="py-2 px-3 text-right">{Number(s.durations)}</td>
                  <td className="py-2 px-3 text-right">{s.avg_seconds != null ? s.avg_seconds : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
