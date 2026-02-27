import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { QuizQuestionForm } from "../../../QuizQuestionForm";
import { notFound } from "next/navigation";

export default async function EditQuizQuestionPage({ params }: { params: { id: string } }) {
    const supabase = createAdminClient();
    const { data: question } = await supabase
        .from("quiz_questions")
        .select("*")
        .eq("id", params.id)
        .single();

    if (!question) notFound();

    return (
        <div>
            <AdminPageHeader
                title="Edit Question"
                breadcrumb={[
                    { label: "Admin", href: "/admin" },
                    { label: "Quiz", href: "/admin/quiz" },
                ]}
            />
            <QuizQuestionForm question={question} />
        </div>
    );
}
