import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { QuizQuestionForm } from "../../../QuizQuestionForm";
import { notFound } from "next/navigation";

export default async function EditQuizQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!sql) notFound();

  const rows = await sql`SELECT * FROM quiz_questions WHERE id = ${id} LIMIT 1`;
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) notFound();
  const correctIndex = typeof row.correct_index === "number" ? row.correct_index : 0;
  const question = { ...row, correct_answer: String.fromCharCode(65 + correctIndex) };

  return (
    <div>
      <AdminPageHeader
        title="Edit Question"
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Quiz", href: "/admin/quiz" },
        ]}
      />
      <QuizQuestionForm question={question as unknown as Parameters<typeof QuizQuestionForm>[0]["question"]} />
    </div>
  );
}
