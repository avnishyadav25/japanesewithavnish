import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { PracticeTestClient, type ClientSection } from "@/components/learn/PracticeTestClient";

type Item = { id: string; title: string; slug: string; jlpt_level?: string | null };
type Test = {
  id: string;
  duration_minutes: number;
  passing_score_percent: number;
  instructions: string | null;
  pdf_url: string | null;
  test_variant: string;
  attempt_policy: string;
};

const TEST_VARIANT_LABELS: Record<string, string> = { full: "Full mock test", mini: "Mini mock test" };
const ATTEMPT_POLICY_LABELS: Record<string, string> = { unlimited: "Unlimited attempts", one_time: "One attempt only" };

const SECTION_TYPE_LABELS: Record<string, string> = {
  vocabulary: "Vocabulary",
  grammar: "Grammar",
  reading: "Reading",
  listening: "Listening",
};

/** Public detail/intro page for a real (sections + scored questions) practice test —
 * intercepted early in LearnDetailContent, ahead of the generic markdown/PDF-link
 * rendering, once a post has real practice_test_sections built for it. Reuses the
 * same "sign in to take this" gate as /learn/exam (MockExamClient). */
export async function PracticeTestDetail({
  item,
  test,
  sections,
  breadcrumbBase,
}: {
  item: Item;
  test: Test;
  sections: ClientSection[];
  breadcrumbBase: string;
}) {
  const session = await getSession();
  const totalQuestions = sections.reduce((sum, s) => sum + s.questions.length, 0);

  return (
    <div className="py-12 sm:py-16 px-6 sm:px-8 lg:px-12 pb-24 lg:pb-16">
      <div className="max-w-[900px] mx-auto">
        <nav className="text-sm text-secondary mb-6">
          <Link href="/" className="hover:text-primary">Home</Link>
          <span className="mx-2">/</span>
          <Link href={breadcrumbBase} className="hover:text-primary">Learn</Link>
          <span className="mx-2">/</span>
          <Link href={`${breadcrumbBase}/practice_test`} className="hover:text-primary">Practice test</Link>
          <span className="mx-2">/</span>
          <span className="text-charcoal truncate max-w-[200px]">{item.title}</span>
        </nav>

        <div className="flex flex-wrap gap-4 text-secondary text-sm mb-6">
          {item.jlpt_level && (
            <span className="px-2 py-0.5 rounded bg-base border border-[var(--divider)]">{item.jlpt_level}</span>
          )}
        </div>

        <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-charcoal mb-2">{item.title}</h1>
        <p className="text-secondary text-xs italic mb-4">
          Platform-designed JLPT-style simulation — not an official/licensed JLPT test.
        </p>

        {test.instructions && <p className="text-secondary leading-relaxed mb-6">{test.instructions}</p>}

        <div className="bg-base border border-[var(--divider)] rounded-[10px] p-5 mb-6 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-secondary text-xs uppercase tracking-wide">Total time</div>
            <div className="font-semibold text-charcoal">{test.duration_minutes} min</div>
          </div>
          <div>
            <div className="text-secondary text-xs uppercase tracking-wide">Sections</div>
            <div className="font-semibold text-charcoal">{sections.length}</div>
          </div>
          <div>
            <div className="text-secondary text-xs uppercase tracking-wide">Questions</div>
            <div className="font-semibold text-charcoal">{totalQuestions}</div>
          </div>
          <div>
            <div className="text-secondary text-xs uppercase tracking-wide">Passing score</div>
            <div className="font-semibold text-charcoal">{test.passing_score_percent}%</div>
          </div>
          <div>
            <div className="text-secondary text-xs uppercase tracking-wide">Format</div>
            <div className="font-semibold text-charcoal">{TEST_VARIANT_LABELS[test.test_variant] ?? test.test_variant}</div>
          </div>
          <div>
            <div className="text-secondary text-xs uppercase tracking-wide">Attempt policy</div>
            <div className="font-semibold text-charcoal">{ATTEMPT_POLICY_LABELS[test.attempt_policy] ?? test.attempt_policy}</div>
          </div>
        </div>

        <div className="space-y-2 mb-8">
          {sections.map((s, i) => (
            <div key={s.id} className="flex items-center justify-between border border-[var(--divider)] rounded-bento px-4 py-2.5 text-sm">
              <span className="text-charcoal font-medium">{i + 1}. {s.title}</span>
              <span className="text-secondary text-xs">
                {SECTION_TYPE_LABELS[s.section_type] ?? s.section_type} · {s.questions.length} question{s.questions.length === 1 ? "" : "s"}
                {s.time_limit_minutes ? ` · ${s.time_limit_minutes} min` : ""}
              </span>
            </div>
          ))}
        </div>

        {test.pdf_url && (
          <a href={test.pdf_url} target="_blank" rel="noopener noreferrer" className="text-primary text-sm hover:underline block mb-8">
            Download official PDF →
          </a>
        )}

        {session?.email ? (
          <PracticeTestClient
            testId={test.id}
            title={item.title}
            sections={sections}
            passingScorePercent={test.passing_score_percent}
            jlptLevel={item.jlpt_level}
            durationMinutes={test.duration_minutes}
          />
        ) : (
          <div className="bg-white border border-[var(--divider)] rounded-bento p-6 text-center">
            <p className="text-secondary text-sm mb-3">Sign in to take this practice test and save your score.</p>
            <Link href={`/login?redirect=${breadcrumbBase}/practice_test/${item.slug}`} className="btn-primary inline-flex h-10 px-5 rounded-xl text-sm font-bold font-heading items-center">
              Sign In
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
