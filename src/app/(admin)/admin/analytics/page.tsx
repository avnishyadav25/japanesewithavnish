import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminTable } from "@/components/admin/AdminTable";
import Link from "next/link";

type Row = {
  path: string | null;
  content_type: string;
  content_id: string;
  views: number;
  sessions: number;
  avg_seconds: number | null;
};
type CountryRow = { country: string | null; views: number };

export default async function AdminAnalyticsPage() {
  let stats: Row[] = [];
  let countries: CountryRow[] = [];
  let totals = { views: 0, sessions: 0, duration_events: 0 };
  if (sql) {
    try {
      const rows = await sql`
        SELECT
          COALESCE(path, content_id) AS path,
          content_type,
          content_id,
          COUNT(*) FILTER (WHERE event_type = 'view') AS views,
          COUNT(DISTINCT session_id) FILTER (WHERE session_id IS NOT NULL) AS sessions,
          ROUND(AVG(duration_seconds) FILTER (WHERE event_type = 'duration'))::int AS avg_seconds
        FROM content_events
        GROUP BY path, content_type, content_id
        ORDER BY views DESC
        LIMIT 50
      ` as Row[];
      stats = rows ?? [];
    } catch {
      // Table may not exist
    }
    try {
      const rows = await sql`
        SELECT COALESCE(country, 'unknown') AS country, COUNT(*) FILTER (WHERE event_type = 'view')::int AS views
        FROM content_events
        GROUP BY country
        ORDER BY views DESC
        LIMIT 10
      ` as CountryRow[];
      countries = rows ?? [];
    } catch {
      // Extended analytics columns may not exist yet
    }
    try {
      const rows = await sql`
        SELECT
          COUNT(*) FILTER (WHERE event_type = 'view')::int AS views,
          COUNT(DISTINCT session_id) FILTER (WHERE session_id IS NOT NULL)::int AS sessions,
          COUNT(*) FILTER (WHERE event_type = 'duration')::int AS duration_events
        FROM content_events
      ` as typeof totals[];
      totals = rows?.[0] ?? totals;
    } catch {
      // ignore
    }
  }

  const cards = [
    { href: "/admin/analytics/users", title: "Users", desc: "Signup, verification, premium mix, and recent users." },
    { href: "/admin/analytics/learning", title: "Learning", desc: "Lesson completions, active learners, top lessons, and weak pages." },
    { href: "/admin/analytics/revenue", title: "Revenue", desc: "Paid revenue, failed payments, coupons, plan split, and recent orders." },
    { href: "/admin/analytics/cohorts", title: "Cohorts", desc: "Weekly signup retention, premium conversion, and average lessons." },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Analytics"
        breadcrumb={[{ label: "Admin", href: "/admin" }]}
      />
      <p className="text-secondary text-sm mb-6">
        Operational first-party analytics for learning, revenue, users, cohorts, and pages. Use GA4/GTM as the source of truth for full acquisition and traffic reporting.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <AdminCard><p className="text-xs uppercase tracking-wider text-secondary">Page views</p><p className="font-heading text-3xl font-bold">{Number(totals.views)}</p></AdminCard>
        <AdminCard><p className="text-xs uppercase tracking-wider text-secondary">Unique sessions</p><p className="font-heading text-3xl font-bold">{Number(totals.sessions)}</p></AdminCard>
        <AdminCard><p className="text-xs uppercase tracking-wider text-secondary">Duration events</p><p className="font-heading text-3xl font-bold">{Number(totals.duration_events)}</p></AdminCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="block">
            <AdminCard className="h-full hover:border-primary transition">
              <h2 className="font-heading text-lg font-semibold text-charcoal">{card.title}</h2>
              <p className="text-sm text-secondary mt-2">{card.desc}</p>
            </AdminCard>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
        <AdminCard>
          <h2 className="font-heading text-lg font-semibold mb-4">Top Pages</h2>
          {stats.length ? (
            <AdminTable headers={["Path", "Type", "Views", "Sessions", "Avg duration"]}>
              {stats.map((s) => (
                <tr key={`${s.content_type}-${s.content_id}-${s.path}`} className="border-b border-[var(--divider)]">
                  <td className="py-2 px-2 font-mono text-xs">{s.path || s.content_id}</td>
                  <td className="py-2 px-2">{s.content_type}</td>
                  <td className="py-2 px-2">{Number(s.views)}</td>
                  <td className="py-2 px-2">{Number(s.sessions)}</td>
                  <td className="py-2 px-2">{s.avg_seconds != null ? `${s.avg_seconds}s` : "-"}</td>
                </tr>
              ))}
            </AdminTable>
          ) : (
            <AdminEmptyState message="No analytics events yet. Public page views will appear here after visitors browse the site." />
          )}
        </AdminCard>

        <AdminCard>
          <h2 className="font-heading text-lg font-semibold mb-4">Country Distribution</h2>
          {countries.length ? (
            <div className="space-y-3">
              {countries.map((row) => (
                <div key={row.country || "unknown"} className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-charcoal">{row.country || "unknown"}</span>
                  <span className="font-semibold">{Number(row.views)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-secondary">Country headers are not available yet or the analytics migration has not been applied.</p>
          )}
        </AdminCard>
      </div>
    </div>
  );
}
