import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminQuizPage() {
  const supabase = createAdminClient();
  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("id, question_text")
    .order("sort_order")
    .limit(20);
  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("id, email, score, recommended_level, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal mb-6">Quiz</h1>
      <h2 className="font-bold text-charcoal mb-2">Questions ({questions?.length || 0})</h2>
      {questions && questions.length > 0 ? (
        <ul className="space-y-1 mb-8">
          {questions.map((q) => (
            <li key={q.id} className="text-secondary text-sm">{q.question_text}</li>
          ))}
        </ul>
      ) : (
        <p className="text-secondary mb-8">No questions. Add via SQL or admin UI.</p>
      )}
      <h2 className="font-bold text-charcoal mb-2">Recent Attempts</h2>
      {attempts && attempts.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Email</th>
                <th className="text-left py-2">Score</th>
                <th className="text-left py-2">Level</th>
                <th className="text-left py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id} className="border-b">
                  <td className="py-2">{a.email}</td>
                  <td className="py-2">{a.score}</td>
                  <td className="py-2">{a.recommended_level}</td>
                  <td className="py-2">{new Date(a.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-secondary">No attempts yet.</p>
      )}
    </div>
  );
}
