import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

const LEVEL_COLORS: Record<string, string> = {
  N5: "bg-green-100 text-green-800",
  N4: "bg-yellow-100 text-yellow-800",
  N3: "bg-orange-100 text-orange-800",
  N2: "bg-red-100 text-red-800",
  N1: "bg-purple-100 text-purple-800",
};

type Attempt = { id: string; email: string; score: number; recommended_level: string | null; created_at: string };

export default async function AdminQuizAttemptsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  let attempts: Attempt[] = [];

  if (sql) {
    try {
      attempts = (q
        ? await sql`
            SELECT id, email, score, recommended_level, created_at::text
            FROM quiz_attempts
            WHERE email ILIKE ${`%${q}%`}
            ORDER BY created_at DESC
            LIMIT 200
          `
        : await sql`
            SELECT id, email, score, recommended_level, created_at::text
            FROM quiz_attempts
            ORDER BY created_at DESC
            LIMIT 200
          `) as unknown as Attempt[];
    } catch (e) {
      console.error("Admin quiz attempts:", e);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Quiz Attempts"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Quiz" }, { label: "Attempts" }]}
      />
      <AdminCard>
        <form className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Filter by email..."
            className="flex-1 h-10 px-3 border border-[var(--divider)] rounded-xl text-xs text-charcoal focus:outline-none"
          />
          <button type="submit" className="btn-primary text-xs px-4 h-10">Filter</button>
        </form>
      </AdminCard>

      {attempts.length > 0 ? (
        <AdminCard>
          <AdminTable headers={["Email", "Score", "Recommended Level", "Date"]}>
            {attempts.map((a) => (
              <tr key={a.id} className="border-b border-[var(--divider)] hover:bg-[var(--base)] transition-colors">
                <td className="py-2 px-2 font-medium text-charcoal">{a.email}</td>
                <td className="py-2 px-2 text-secondary">{a.score}</td>
                <td className="py-2 px-2">
                  {a.recommended_level ? (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${LEVEL_COLORS[a.recommended_level] ?? "bg-gray-100 text-gray-700"}`}>
                      {a.recommended_level}
                    </span>
                  ) : "—"}
                </td>
                <td className="py-2 px-2 text-secondary text-xs">{new Date(a.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      ) : (
        <AdminEmptyState message="No matching quiz attempts found." />
      )}
    </div>
  );
}
export const dynamic = "force-dynamic";
