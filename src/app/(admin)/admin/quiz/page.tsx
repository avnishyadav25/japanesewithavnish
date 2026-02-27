import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";

export default async function AdminQuizPage() {
  const supabase = createAdminClient();
  const [
    { data: questions },
    { data: thresholds },
    { data: attempts },
  ] = await Promise.all([
    supabase
      .from("quiz_questions")
      .select("id, question_text, jlpt_level, sort_order")
      .order("sort_order")
      .limit(20),
    supabase
      .from("quiz_thresholds")
      .select("level, min_score, recommended_product_id")
      .order("level"),
    supabase
      .from("quiz_attempts")
      .select("id, email, score, recommended_level, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div>
      <AdminPageHeader title="Quiz" breadcrumb={[{ label: "Admin", href: "/admin" }]} />

      <div className="bento-grid mb-8">
        <AdminCard className="bento-span-3" shoji>
          <h2 className="font-heading font-bold text-charcoal mb-4">
            Questions ({questions?.length || 0})
          </h2>
          {questions && questions.length > 0 ? (
            <ul className="space-y-2">
              {questions.map((q) => (
                <li key={q.id} className="text-secondary text-sm flex items-start gap-2">
                  <span className="text-charcoal font-medium truncate max-w-[200px] sm:max-w-none">
                    {q.question_text}
                  </span>
                  {q.jlpt_level && (
                    <span className="text-xs flex-shrink-0">{q.jlpt_level}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-secondary text-sm">No questions. Add via SQL or admin UI.</p>
          )}
        </AdminCard>
        <AdminCard className="bento-span-3">
          <h2 className="font-heading font-bold text-charcoal mb-4">Thresholds</h2>
          {thresholds && thresholds.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--divider)]">
                    <th className="text-left py-2">Level</th>
                    <th className="text-left py-2">Min Score</th>
                  </tr>
                </thead>
                <tbody>
                  {thresholds.map((t) => (
                    <tr key={t.level} className="border-b border-[var(--divider)]">
                      <td className="py-2">{t.level}</td>
                      <td className="py-2">{t.min_score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-secondary text-sm">No thresholds configured.</p>
          )}
        </AdminCard>
      </div>

      <h2 className="font-heading text-lg font-bold text-charcoal mb-4">Recent Attempts</h2>
      <AdminCard>
        {attempts && attempts.length > 0 ? (
          <AdminTable headers={["Email", "Score", "Level", "Date"]}>
            {attempts.map((a) => (
              <tr key={a.id} className="border-b border-[var(--divider)]">
                <td className="py-2 px-2">{a.email}</td>
                <td className="py-2 px-2">{a.score}</td>
                <td className="py-2 px-2">{a.recommended_level}</td>
                <td className="py-2 px-2 text-secondary text-xs">
                  {new Date(a.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </AdminTable>
        ) : (
          <p className="text-secondary py-8 text-center">No attempts yet.</p>
        )}
      </AdminCard>
    </div>
  );
}
