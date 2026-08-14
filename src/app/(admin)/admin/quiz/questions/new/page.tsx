import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { QuizQuestionForm } from "../../QuizQuestionForm";

export default function NewQuizQuestionPage() {
    return (
        <div>
            <AdminPageHeader
                title="New Question"
                breadcrumb={[
                    { label: "Admin", href: "/admin" },
                    { label: "Quiz", href: "/admin/quiz" },
                ]}
            />
            <QuizQuestionForm />
        </div>
    );
}
