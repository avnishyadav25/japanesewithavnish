import { getQuizQuestions } from "@/lib/quiz-data";
import QuizClient from "./QuizClient";

export const metadata = {
  title: "Find Your Japanese Level | JLPT Placement Quiz",
  description: "Take our free 25-question adaptive placement quiz covering Grammar, Vocabulary, and Kanji to find your JLPT level in about 5 minutes.",
};

export default async function QuizPage() {
  const questions = await getQuizQuestions().catch(() => []);

  return (
    <div className="bg-[#FAF8F5] py-12 sm:py-16 px-4 sm:px-6 min-h-screen">
      <div className="max-w-[1200px] mx-auto mb-8 text-center">
        <h1 className="font-heading text-3xl font-bold text-charcoal mb-2">Find Your Japanese Level</h1>
        <p className="text-secondary text-sm">
          25 adaptive questions · Grammar • Vocabulary • Kanji · Approximately 5 minutes
        </p>
      </div>
      <QuizClient initialQuestions={questions} />
    </div>
  );
}
