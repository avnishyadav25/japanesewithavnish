import Link from "next/link";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

type StudentRow = {
  email: string;
  recommended_level: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean | null;
  last_login_at: string | null;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  learned_count: number;
  due_count: number;
  total_points: number;
};

export default async function AdminStudentsPage() {
  let students: StudentRow[] = [];
  let total = 0;

  if (sql) {
    try {
      const countRows = (await sql`
        SELECT COUNT(*)::int AS c FROM profiles
      `) as unknown as { c: number }[];

      const rows = (await sql`
        SELECT
          p.email,
          p.recommended_level,
          p.display_name,
          p.first_name,
          p.last_name,
          p.is_active,
          p.last_login_at::text,
          COALESCE(p.current_streak, 0)::int AS current_streak,
          COALESCE(p.longest_streak, 0)::int AS longest_streak,
          p.last_activity_date::text,
          (SELECT COUNT(*)::int FROM user_learning_progress u WHERE u.user_email = p.email AND u.status = 'learned') AS learned_count,
          (SELECT COUNT(*)::int FROM review_schedule r WHERE r.user_email = p.email AND r.next_review_at <= NOW()) AS due_count,
          (SELECT COALESCE(SUM(e.points), 0)::int FROM reward_events e WHERE e.user_email = p.email) AS total_points
        FROM profiles p
        ORDER BY p.last_activity_date DESC NULLS LAST, p.updated_at DESC
        LIMIT 100
      `) as unknown as StudentRow[];

      total = countRows?.[0]?.c ?? 0;
      students = rows ?? [];
    } catch (e) {
      console.error("Admin students:", e);
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Students"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Students" }]}
      />
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="card-content bento-span-2 inline-block w-fit">
          <p className="text-secondary text-sm uppercase tracking-wider">Total</p>
          <p className="font-heading text-2xl font-bold text-charcoal">{total}</p>
        </div>
      </div>
      {students.length > 0 ? (
        <AdminCard>
          <AdminTable
            headers={[
              "Email",
              "Name",
              "Level",
              "Active",
              "Streak",
              "Learned",
              "Due",
              "Points",
              "Last login",
              "Last activity",
            ]}
          >
            {students.map((s) => (
              <tr key={s.email} className="border-b border-[var(--divider)]">
                <td className="py-2 px-2 font-medium text-charcoal">
                  <Link href={`/admin/students/${encodeURIComponent(s.email)}`} className="text-primary hover:underline">
                    {s.email}
                  </Link>
                </td>
                <td className="py-2 px-2 text-secondary">{(s.display_name || [s.first_name, s.last_name].filter(Boolean).join(" ") || "—")}</td>
                <td className="py-2 px-2">
                  {s.recommended_level ? (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {s.recommended_level}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2 px-2">
                  {s.is_active === false ? (
                    <span className="text-xs text-secondary">No</span>
                  ) : (
                    <span className="text-xs text-green-600">Yes</span>
                  )}
                </td>
                <td className="py-2 px-2 text-secondary">
                  {s.current_streak} <span className="text-xs">(best: {s.longest_streak})</span>
                </td>
                <td className="py-2 px-2 text-secondary">{s.learned_count}</td>
                <td className="py-2 px-2 text-secondary">{s.due_count}</td>
                <td className="py-2 px-2 text-secondary">{s.total_points}</td>
                <td className="py-2 px-2 text-secondary text-xs">
                  {s.last_login_at ? new Date(s.last_login_at).toLocaleString() : "—"}
                </td>
                <td className="py-2 px-2 text-secondary text-xs">
                  {s.last_activity_date
                    ? new Date(s.last_activity_date).toLocaleDateString()
                    : "—"}
                </td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      ) : (
        <AdminEmptyState message="No students yet. Users will appear here after signing up or taking the quiz." />
      )}
    </div>
  );
}
