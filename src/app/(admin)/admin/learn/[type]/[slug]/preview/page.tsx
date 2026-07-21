import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { getAdminSession } from "@/lib/auth/admin";
import { LEARN_CONTENT_TYPES, LEARN_TYPE_LABELS, type LearnContentType } from "@/lib/learn-filters";
import { LessonMetaContent } from "@/components/learn/LessonMetaContent";
import { LearnMarkdown } from "@/components/learn/LearnMarkdown";
import { reorderContentExamplesLast, boldContentLabels } from "@/lib/learn-content";
import { PracticeTestDetail } from "@/components/learn/PracticeTestDetail";
import type { ClientSection } from "@/components/learn/PracticeTestClient";

type Meta = Record<string, unknown> | null;

export default async function AdminLearnPreviewPage({
  params,
}: {
  params: Promise<{ type: string; slug: string }>;
}) {
  const admin = await getAdminSession();
  if (!admin) notFound();

  const { type, slug: rawSlug } = await params;
  const normalized = type.toLowerCase();
  // See edit/page.tsx: [slug] here isn't the final path segment (followed by
  // "preview"), so Next.js doesn't auto-decode it — non-ASCII slugs arrive
  // still percent-encoded. Decode explicitly; harmless no-op otherwise.
  const slug = decodeURIComponent(rawSlug);
  if (!LEARN_CONTENT_TYPES.includes(normalized as LearnContentType)) notFound();

  if (!sql) notFound();
  const rows = await sql`
    SELECT id, title, content, (jlpt_level)[1] AS jlpt_level, meta, status, og_image_url
    FROM posts
    WHERE content_type = ${normalized} AND slug = ${slug}
    LIMIT 1
  `;
  const item = rows[0] as {
    id: string;
    title: string;
    jlpt_level?: string | null;
    content?: string | null;
    meta?: Meta;
    status?: string;
    og_image_url?: string | null;
  } | undefined;
  if (!item) notFound();

  // A real (sections + scored questions) practice test has no meaningful posts.content to
  // preview below — it renders through the same PracticeTestDetail/Client the public site
  // uses instead, same "structured source wins" pattern as LearnDetailContent.tsx.
  if (normalized === "practice_test") {
    const testRows = (await sql`
      SELECT id, duration_minutes, passing_score_percent, instructions, pdf_url, test_variant, attempt_policy
      FROM practice_tests WHERE post_id = ${item.id} LIMIT 1
    `) as { id: string; duration_minutes: number; passing_score_percent: number; instructions: string | null; pdf_url: string | null; test_variant: string; attempt_policy: string }[];
    const test = testRows[0];
    if (test) {
      const sectionRows = (await sql`
        SELECT id, title, section_type, time_limit_minutes, passage, audio_url
        FROM practice_test_sections WHERE practice_test_id = ${test.id} ORDER BY sort_order, created_at
      `) as Omit<ClientSection, "questions">[];
      if (sectionRows.length > 0) {
        const sectionIds = sectionRows.map((s) => s.id);
        const questionRows = (await sql`
          SELECT id, section_id, question_text, item_type, options, correct_index, explanation, audio_url
          FROM practice_test_questions WHERE section_id = ANY(${sectionIds}) ORDER BY sort_order, created_at
        `) as { id: string; section_id: string; question_text: string; item_type: string | null; options: string[]; correct_index: number; explanation: string | null; audio_url: string | null }[];
        const questionsBySection = new Map<string, ClientSection["questions"]>();
        for (const q of questionRows) {
          const list = questionsBySection.get(q.section_id) ?? [];
          list.push({ id: q.id, question_text: q.question_text, item_type: q.item_type, options: q.options, correct_index: q.correct_index, explanation: q.explanation, audio_url: q.audio_url });
          questionsBySection.set(q.section_id, list);
        }
        const sections: ClientSection[] = sectionRows.map((s) => ({ ...s, questions: questionsBySection.get(s.id) ?? [] }));
        if (sections.some((s) => s.questions.length > 0)) {
          return (
            <div>
              <div className="max-w-[900px] mx-auto px-6 pt-8">
                <div className="p-3 rounded-bento bg-amber-100 border border-amber-300 text-amber-900 text-sm flex items-center justify-between gap-4">
                  <span>Preview mode — only visible to admins</span>
                  <Link href={`/admin/learn/${normalized}/${slug}/edit`} className="font-medium hover:underline">
                    Edit →
                  </Link>
                </div>
              </div>
              <PracticeTestDetail
                item={{ id: item.id, title: item.title, slug, jlpt_level: item.jlpt_level }}
                test={test}
                sections={sections}
                breadcrumbBase="/learn"
              />
            </div>
          );
        }
      }
    }
  }

  const meta = (item.meta ?? {}) as Record<string, unknown>;
  const featureImageUrl = item.og_image_url ?? (typeof meta.feature_image_url === "string" ? meta.feature_image_url : null);
  const contentStr = item.content != null ? String(item.content) : "";

  return (
    <div className="py-12 sm:py-16 px-4 sm:px-6 japanese-wave-bg">
      <div className="max-w-[800px] mx-auto">
        <div className="mb-6 p-3 rounded-bento bg-amber-100 border border-amber-300 text-amber-900 text-sm flex items-center justify-between gap-4">
          <span>Preview mode — only visible to admins</span>
          <Link href={`/admin/learn/${normalized}/${slug}/edit`} className="font-medium hover:underline">
            Edit →
          </Link>
        </div>
        <nav className="text-sm text-secondary mb-8 flex items-center gap-2">
          <Link href="/admin" className="hover:text-primary">Admin</Link>
          <span className="opacity-50">／</span>
          <Link href={`/admin/learn/${normalized}`} className="hover:text-primary">
            {LEARN_TYPE_LABELS[normalized as LearnContentType]}
          </Link>
          <span className="opacity-50">／</span>
          <span className="text-charcoal truncate max-w-[200px]">{item.title}</span>
        </nav>

        <article className="card-content japanese-shoji-border">
          <div className="flex items-center gap-2 mb-4">
            <span className="japanese-kanji-accent text-lg">{LEARN_TYPE_LABELS[normalized as LearnContentType]}</span>
            {item.jlpt_level && <span className="text-xs text-secondary">{item.jlpt_level}</span>}
            {item.status === "draft" && (
              <span className="text-xs px-2 py-0.5 rounded bg-amber-200 text-amber-900">Draft</span>
            )}
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-charcoal mb-6">
            {item.title}
          </h1>

          {featureImageUrl ? (
            <div className="rounded-bento overflow-hidden border border-[var(--divider)] mb-6 aspect-video max-w-full bg-[var(--divider)]/20">
              <img src={featureImageUrl} alt="" className="w-full h-full object-cover" />
            </div>
          ) : null}

          <LessonMetaContent contentType={normalized} meta={meta} />

          {contentStr ? (
            <div className="prose prose-charcoal max-w-none text-secondary mt-6">
              <LearnMarkdown content={boldContentLabels(reorderContentExamplesLast(contentStr))} meta={meta} contentType={normalized} />
            </div>
          ) : (
            <p className="text-secondary mt-6 italic">No main content yet.</p>
          )}
        </article>

        <div className="mt-8 flex gap-3">
          <Link href={`/admin/learn/${normalized}/${slug}/edit`} className="btn-primary">
            Edit
          </Link>
          <Link href={`/admin/learn/${normalized}`} className="btn-secondary">
            ← Back to list
          </Link>
        </div>
      </div>
    </div>
  );
}
