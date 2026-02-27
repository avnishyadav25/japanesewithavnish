import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";

const LEVEL_COLORS: Record<string, string> = {
  N5: "bg-green-100 text-green-800",
  N4: "bg-yellow-100 text-yellow-800",
  N3: "bg-orange-100 text-orange-800",
  N2: "bg-red-100 text-red-800",
  N1: "bg-purple-100 text-purple-800",
};

export default async function AdminQuizPage() {
  const supabase = createAdminClient();
  const [
    { data: questions, count: questionCount },
    { data: thresholds },
    { data: attempts },
    { data: attemptStats },
  ] = await Promise.all([
    supabase
      .from("quiz_questions")
      .select("id, question_text, jlpt_level, sort_order, correct_answer", { count: "exact" })
      .order("sort_order"),
    supabase
      .from("quiz_thresholds")
      .select("level, min_score, recommended_product_id")
      .order("level"),
    supabase
      .from("quiz_attempts")
      .select("id, email, score, recommended_level, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("quiz_attempts")
      .select("recommended_level"),
  ]);

  const levelCounts = (attemptStats || []).reduce<Record<string, number>>((acc, a) => {
    if (a.recommended_level) acc[a.recommended_level] = (acc[a.recommended_level] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="animate-fade-in">
      <AdminPageHeader
        title="Quiz"
        breadcrumb={[{ label: "Admin", href: "/admin" }]}
        action={{ label: "New Question", href: "/admin/quiz/questions/new" }}
      />

      {/* Stats */}
      <div className="bento-grid mb-8">
        {[
          { label: "Total Questions", value: questionCount ?? 0 },
          { label: "Total Attempts", value: attempts?.length ?? 0 },
          ...["N5", "N4", "N3", "N2", "N1"].map((l) => ({
            label: `${l} Recommended`,
            value: levelCounts[l] ?? 0,
          })),
        ].slice(0, 6).map((s, i) => (
          <div
            key={s.label}
            className="bento-span-2 card-content"
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <p className="text-secondary text-xs uppercase tracking-wider">{s.label}</p>
            <p className="font-heading text-2xl font-bold text-charcoal mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Questions table */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-lg font-bold text-charcoal">
            Questions ({questionCount ?? 0})
          </h2>
          <Link href="/admin/quiz/questions/new" className="btn-primary text-sm px-4 py-2 h-auto">
            + New Question
          </Link>
        </div>
        <AdminCard>
          {questions && questions.length > 0 ? (
            <AdminTable headers={["#", "Question", "Level", "Answer", "Actions"]}>
              {questions.map((q, i) => (
                <tr key={q.id} className="border-b border-[var(--divider)] hover:bg-[var(--base)] transition-colors">
                  <td className="py-2 px-2 text-secondary text-xs w-8">{i + 1}</td>
                  <td className="py-2 px-2 text-charcoal font-medium max-w-xs">
                    <span className="line-clamp-2">{q.question_text}</span>
                  </td>
                  <td className="py-2 px-2">
                    {q.jlpt_level ? (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${LEVEL_COLORS[q.jlpt_level] ?? "bg-gray-100 text-gray-700"}`}>
                        {q.jlpt_level}
                      </span>
                    ) : (
                      <span className="text-secondary text-xs">—</span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-secondary text-xs font-mono">{q.correct_answer}</td>
                  <td className="py-2 px-2">
                    <Link
                      href={`/admin/quiz/questions/${q.id}/edit`}
                      className="text-primary text-sm hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </AdminTable>
          ) : (
            <div className="py-12 text-center">
              <p className="text-secondary mb-4">No quiz questions yet.</p>
              <Link href="/admin/quiz/questions/new" className="btn-primary">
                Add First Question
              </Link>
            </div>
          )}
        </AdminCard>
      </div>

      {/* Thresholds */}
      <div className="mb-8">
        <h2 className="font-heading text-lg font-bold text-charcoal mb-4">
          Level Thresholds
        </h2>
        <AdminCard>
          {thresholds && thresholds.length > 0 ? (
            <AdminTable headers={["Level", "Min Score", "Recommended Product"]}>
              {thresholds.map((t) => (
                <tr key={t.level} className="border-b border-[var(--divider)]">
                  <td className="py-2 px-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${LEVEL_COLORS[t.level] ?? "bg-gray-100 text-gray-700"}`}>
                      {t.level}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-charcoal">{t.min_score}</td>
                  <td className="py-2 px-2 text-secondary text-xs font-mono">{t.recommended_product_id ?? "—"}</td>
                </tr>
              ))}
            </AdminTable>
          ) : (
            <p className="text-secondary text-sm py-4">
              No thresholds configured. Add rows to <code className="bg-[var(--base)] px-1 rounded">quiz_thresholds</code> table in Supabase.
            </p>
          )}
        </AdminCard>
      </div>

      {/* Recent Attempts */}
      <h2 className="font-heading text-lg font-bold text-charcoal mb-4">Recent Attempts</h2>
      <AdminCard>
        {attempts && attempts.length > 0 ? (
          <AdminTable headers={["Email", "Score", "Level", "Date"]}>
            {attempts.map((a) => (
              <tr key={a.id} className="border-b border-[var(--divider)]">
                <td className="py-2 px-2">{a.email}</td>
                <td className="py-2 px-2">{a.score}</td>
                <td className="py-2 px-2">
                  {a.recommended_level ? (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${LEVEL_COLORS[a.recommended_level] ?? "bg-gray-100 text-gray-700"}`}>
                      {a.recommended_level}
                    </span>
                  ) : "—"}
                </td>
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
