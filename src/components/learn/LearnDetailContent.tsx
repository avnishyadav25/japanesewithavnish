import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import {
  LEARN_CONTENT_TYPES,
  LEARN_TYPE_LABELS,
  type LearnContentType,
  type LearnItemForFilter,
} from "@/lib/learn-filters";
import { LessonMetaContent, SoundsCharactersBlock } from "@/components/learn/LessonMetaContent";
import { LearnLessonCard } from "@/components/learn/LearnLessonCard";
import { BlogCommentList } from "@/components/BlogCommentList";
import { LearnCommentForm } from "@/components/learn/LearnCommentForm";
import { LearnMarkdown } from "@/components/learn/LearnMarkdown";
import { JLPTVerificationBox } from "@/components/learn/JLPTVerificationBox";
import { LearnMarkAsLearned } from "@/components/learn/LearnMarkAsLearned";
import { LearnStickyCta } from "@/components/learn/LearnStickyCta";
import { BlogTableOfContents } from "@/components/blog/BlogTableOfContents";
import { BlogNextStepCta } from "@/components/blog/BlogNextStepCta";
import { reorderContentExamplesLast, boldContentLabels } from "@/lib/learn-content";
import { getRelatedGrammar } from "@/lib/learn/getRelatedGrammar";
import { ReportIssueButton } from "@/components/learn/ReportIssueButton";
import { isReviewEntityType } from "@/lib/contentReview/types";
import { PracticeTestDetail } from "@/components/learn/PracticeTestDetail";
import type { ClientSection } from "@/components/learn/PracticeTestClient";
import { LessonBlockRenderer } from "@/components/curriculum/LessonBlockRenderer";
import { getResolvedContentBlocks } from "@/lib/blocks/getContentBlocks";
import type { ResolvedBlock } from "@/lib/curriculum/getLessonBlocks";
import type { BlockType as RichContentBlockType } from "@/lib/blocks/blockTypes";

const RICH_CONTENT_BLOCK_TYPES: RichContentBlockType[] = [
  "kanji_radicals",
  "similar_kanji",
  "memory_aid",
  "grammar_formation",
  "nuance",
  "register",
  "when_not_to_use",
  "collocations",
  "related_words",
  // Spec §7 gap, closed in the Phase 13 reconciliation pass: these already render correctly on
  // curriculum lessons via the same LessonBlockRenderer switch, but were never included in the
  // vocab/grammar/kanji rich-content tail — authored blocks of these types had nowhere to render
  // publicly outside curriculum. No content exists yet that used them (confirmed via query), so
  // this closes a latent gap rather than fixing an active bug.
  "common_mistake",
  "tip",
  "culture_note",
];

type Meta = Record<string, unknown> | null;

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";

/**
 * Next.js's App Router does not reliably decode dynamic segment params that mix literal
 * ASCII with percent-encoded UTF-8 (e.g. slug "vocabulary-n5-%E6%B5%B4..."), so slugs
 * containing Japanese characters arrive here still percent-encoded and never match the DB.
 * decodeURIComponent is a no-op for already-decoded/plain-ASCII slugs, so this is safe to
 * apply unconditionally; the try/catch guards against a literal `%` that isn't valid encoding.
 */
function decodeSlugSegment(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Shared renderer for a single learning-content lesson (grammar/vocabulary/kanji/reading/
 * writing/listening/sounds/study_guide/practice_test), used by both the canonical /learn/[type]/[slug]
 * route and the /blog/study_guide/[slug] route (study_guide stays under /blog as editorial content).
 */
export async function getLearnDetailMetadata({
  typeSegment,
  postSlug: rawPostSlug,
  canonicalBase,
}: {
  typeSegment: string;
  postSlug: string;
  canonicalBase: string;
}) {
  const normalized = typeSegment.toLowerCase();
  const postSlug = decodeSlugSegment(rawPostSlug);

  if (!LEARN_CONTENT_TYPES.includes(normalized as LearnContentType)) return {};
  if (!sql) return {};

  const rows = (await sql`
    SELECT title, seo_title, seo_description, og_image_url
    FROM posts
    WHERE content_type = ${normalized} AND slug = ${postSlug} AND status = 'published'
    LIMIT 1
  `) as { title: string; seo_title: string | null; seo_description: string | null; og_image_url: string | null }[];

  const p = rows[0];
  if (!p) return {};

  const title = p.seo_title?.trim() || p.title;
  const description = p.seo_description?.trim() || undefined;
  const url = `${BASE}${canonicalBase}/${normalized}/${encodeURIComponent(postSlug)}`;

  return {
    title: title ? `${title} | Japanese with Avnish` : undefined,
    description,
    openGraph: {
      title: title || undefined,
      description: description || undefined,
      images: p.og_image_url ? [{ url: p.og_image_url }] : undefined,
      type: "article",
      url,
    },
  };
}

export async function LearnDetailContent({
  typeSegment,
  postSlug: rawSlug,
  breadcrumbBase,
}: {
  typeSegment: string;
  postSlug: string;
  breadcrumbBase: string;
}) {
  const normalized = typeSegment.toLowerCase();
  const slug = decodeSlugSegment(rawSlug);

  if (!LEARN_CONTENT_TYPES.includes(normalized as LearnContentType)) notFound();

  if (!sql) notFound();
  const rows = await sql`
    SELECT id, slug, title, content, content_type, (jlpt_level)[1] AS jlpt_level, tags, meta, status, sort_order, created_at, updated_at, og_image_url
    FROM posts
    WHERE content_type = ${normalized} AND slug = ${slug} AND status = 'published'
    LIMIT 1
  `;
  const item = rows[0] as {
    id: string;
    title: string;
    slug: string;
    content_type: string;
    jlpt_level?: string | null;
    content?: string | null;
    meta?: Meta;
    tags?: string[] | null;
    sort_order?: number;
    created_at?: string | null;
    updated_at?: string | null;
    og_image_url?: string | null;
  } | undefined;
  if (!item) notFound();

  // A real (sections + scored questions) practice test takes precedence over the legacy
  // PDF/audio-link-only rendering below — same "real structured content wins, safe fallback
  // otherwise" pattern already used for Reading (content_blocks) and Writing (composition).
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
            <PracticeTestDetail
              item={{ id: item.id, title: item.title, slug: item.slug, jlpt_level: item.jlpt_level }}
              test={test}
              sections={sections}
              breadcrumbBase={breadcrumbBase}
            />
          );
        }
      }
    }
  }

  const meta = (item.meta ?? {}) as Record<string, unknown>;
  const featureImageUrl =
    item.og_image_url ?? (typeof meta.feature_image_url === "string" ? meta.feature_image_url : null);

  // Examples now live in the `examples` table for content types with a
  // dedicated admin editor (Phase 1 of the admin content-editor overhaul) —
  // prefer those rows, falling back to the legacy posts.meta.examples array
  // for any item not yet backfilled/re-saved through the new editor.
  async function preferSidecarExamples(fkColumn: "vocabulary_id" | "grammar_id" | "kanji_id", sidecarId: string) {
    const exampleRows = (await sql!.query(
      `SELECT sentence_ja, sentence_romaji, sentence_en FROM examples WHERE ${fkColumn} = $1 ORDER BY sort_order, sentence_ja`,
      [sidecarId]
    )) as unknown as { sentence_ja: string; sentence_romaji: string | null; sentence_en: string }[];
    if (exampleRows.length > 0) {
      meta.examples = exampleRows.map((e) => ({ japanese: e.sentence_ja, romaji: e.sentence_romaji ?? "", translation: e.sentence_en }));
    }
  }

  if (normalized === "vocabulary") {
    // Same unification as kanji: prefer the authoritative `vocabulary` table's
    // part_of_speech/transitivity over posts.meta.type, which can be freeform/inconsistent.
    const vocabRows = (await sql`
      SELECT id, part_of_speech, transitivity FROM vocabulary WHERE post_id = ${item.id} LIMIT 1
    `) as { id: string; part_of_speech: string | null; transitivity: string | null }[];
    const vocabRow = vocabRows[0];
    if (vocabRow) {
      if (vocabRow.part_of_speech) meta.type = vocabRow.part_of_speech;
      if (vocabRow.transitivity) meta.transitivity = vocabRow.transitivity;
      await preferSidecarExamples("vocabulary_id", vocabRow.id);
    }
  }

  if (normalized === "grammar") {
    const grammarRows = (await sql`SELECT id FROM grammar WHERE post_id = ${item.id} LIMIT 1`) as { id: string }[];
    if (grammarRows[0]) await preferSidecarExamples("grammar_id", grammarRows[0].id);
  }

  if (normalized === "kanji") {
    // The posts.meta JSONB onyomi/kunyomi (author/AI-entered) can disagree in casing/format
    // with the dictionary-sourced `kanji` table used by the /learn/kana/kanji grid. Prefer
    // the authoritative table data so both surfaces show the same readings.
    const kanjiRows = (await sql`
      SELECT id, character, meaning, meaning_extended, stroke_count, onyomi, kunyomi
      FROM kanji WHERE post_id = ${item.id} LIMIT 1
    `) as { id: string; character: string; meaning: string | null; meaning_extended: string | null; stroke_count: number | null; onyomi: string[] | null; kunyomi: string[] | null }[];
    const kanjiRow = kanjiRows[0];
    if (kanjiRow) {
      if (kanjiRow.character) meta.character = kanjiRow.character;
      if (kanjiRow.meaning) meta.meaning = kanjiRow.meaning;
      if (kanjiRow.meaning_extended) meta.meaning_extended = kanjiRow.meaning_extended;
      if (kanjiRow.stroke_count != null) meta.stroke_count = kanjiRow.stroke_count;
      if (kanjiRow.onyomi && kanjiRow.onyomi.length > 0) meta.onyomi = kanjiRow.onyomi;
      if (kanjiRow.kunyomi && kanjiRow.kunyomi.length > 0) meta.kunyomi = kanjiRow.kunyomi;
      await preferSidecarExamples("kanji_id", kanjiRow.id);
    }
  }

  let readingBlocks: ResolvedBlock[] = [];
  if (normalized === "reading") {
    // Real cutover (Phase 9), not the earlier single-field patch: a reading post with >=1
    // published content_blocks row renders its full ordered block set via LessonBlockRenderer
    // instead of posts.content markdown — this is also the actual fix for comprehension_question
    // blocks never reaching learners and passage translations being fetched then dropped, not a
    // narrow patch for either bug in isolation. A post with zero published blocks (every reading
    // post as of this phase — migrated in draft/pending, awaiting admin review) falls through to
    // the legacy markdown path completely unchanged, matching the "structured source wins, legacy
    // field is the fallback" pattern already used for examples above.
    const { blocks } = await getResolvedContentBlocks(item.id);
    readingBlocks = blocks;
  }

  let richContentBlocks: ResolvedBlock[] = [];
  if (normalized === "vocabulary" || normalized === "grammar" || normalized === "kanji") {
    const { blocks } = await getResolvedContentBlocks(item.id);
    richContentBlocks = blocks.filter((b) => RICH_CONTENT_BLOCK_TYPES.includes(b.blockType as RichContentBlockType));
  }

  let related: LearnItemForFilter[] = [];
  let comments: { id: string; author_name: string; author_email: string; content: string; created_at: string }[] = [];

  if (normalized === "grammar") {
    // Curriculum-sequence-aware: next lesson in the same submodule, then prerequisite
    // review, then same-level, then any-level fallback — rather than a generic recency sort.
    related = await getRelatedGrammar(item.id, item.jlpt_level ?? null, slug, 6);
  } else {
    // Prefer same-level content first (a beginner page should not recommend advanced mock tests),
    // then fall back to any level in the same content type to fill remaining slots.
    const sameLevelRows = item.jlpt_level
      ? await sql`
          SELECT id, slug, title, content, content_type, (jlpt_level)[1] AS jlpt_level, tags, meta, status, sort_order, created_at, updated_at
          FROM posts
          WHERE content_type = ${normalized} AND status = 'published' AND slug != ${slug} AND (jlpt_level)[1] = ${item.jlpt_level}
          ORDER BY sort_order ASC, created_at DESC
          LIMIT 6
        `
      : [];

    const sameLevelList = (Array.isArray(sameLevelRows) ? sameLevelRows : []) as LearnItemForFilter[];

    if (sameLevelList.length < 6) {
      const excludeSlugs = [slug, ...sameLevelList.map((r) => r.slug)];
      const fallbackRows = await sql`
        SELECT id, slug, title, content, content_type, (jlpt_level)[1] AS jlpt_level, tags, meta, status, sort_order, created_at, updated_at
        FROM posts
        WHERE content_type = ${normalized} AND status = 'published' AND slug != ALL(${excludeSlugs})
        ORDER BY sort_order ASC, created_at DESC
        LIMIT ${6 - sameLevelList.length}
      `;
      const fallbackList = (Array.isArray(fallbackRows) ? fallbackRows : []) as LearnItemForFilter[];
      related = [...sameLevelList, ...fallbackList];
    } else {
      related = sameLevelList;
    }
  }

  try {
    const commentsRows = await sql`
      SELECT id, author_name, author_email, content, created_at
      FROM post_comments
      WHERE post_id = ${item.id} AND status IN ('approved', 'approve')
      ORDER BY created_at ASC
    `;
    comments = (Array.isArray(commentsRows) ? commentsRows : []) as typeof comments;
  } catch {
    comments = [];
  }
  const contentStr = item.content ?? "";
  const reorderedContent = contentStr ? reorderContentExamplesLast(contentStr) : "";
  const contentWithBoldLabels = reorderedContent ? boldContentLabels(reorderedContent) : "";
  // Blocks-mode reading has no markdown "## " headings to build a ToC from (section_heading is a
  // block type, not a markdown heading) — the legacy ToC only applies to the markdown fallback.
  const isReadingBlocksMode = normalized === "reading" && readingBlocks.length > 0;
  const hasToc = !isReadingBlocksMode && reorderedContent.includes("## ");

  return (
    <div className="py-12 sm:py-16 px-6 sm:px-8 lg:px-12 pb-24 lg:pb-16">
      <div className="max-w-[1400px] mx-auto">
        <div className="grid lg:grid-cols-[1fr_280px] gap-8">
          <div>
            <nav className="text-sm text-secondary mb-6">
              <Link href="/" className="hover:text-primary">Home</Link>
              <span className="mx-2">/</span>
              <Link href={breadcrumbBase} className="hover:text-primary">
                {breadcrumbBase === "/blog" ? "Blog" : "Learn"}
              </Link>
              <span className="mx-2">/</span>
              <Link href={`${breadcrumbBase}/${normalized}`} className="hover:text-primary">
                {LEARN_TYPE_LABELS[normalized as LearnContentType]}
              </Link>
              <span className="mx-2">/</span>
              <span className="text-charcoal truncate max-w-[200px]">{item.title}</span>
            </nav>

            <LearnMarkAsLearned slug={slug} />

            <div className="flex flex-wrap gap-4 text-secondary text-sm mb-6">
              {item.jlpt_level && (
                <span className="px-2 py-0.5 rounded bg-base border border-[var(--divider)]">
                  {item.jlpt_level}
                </span>
              )}
              {Array.isArray(item.tags) && item.tags.length > 0 && (
                <div className="flex gap-2">
                  {item.tags.slice(0, 2).map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded bg-base border border-[var(--divider)]">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-charcoal mb-4">
              {item.title}
            </h1>

            {featureImageUrl && (
              <div className="mb-8 rounded-[10px] overflow-hidden border border-[var(--divider)]">
                <img
                  src={featureImageUrl}
                  alt=""
                  className="w-full aspect-video object-cover object-top"
                />
              </div>
            )}

            <div className="flex gap-8">
              {hasToc && (
                <aside className="hidden xl:block w-48 flex-shrink-0">
                  <BlogTableOfContents content={reorderedContent} />
                </aside>
              )}
              <div className="flex-1 min-w-0">
                {normalized === "sounds" && Array.isArray(meta.characters) && (meta.characters as unknown[]).length > 0 && (
                  <SoundsCharactersBlock meta={meta} />
                )}
                {isReadingBlocksMode ? (
                  <LessonBlockRenderer blocks={readingBlocks} />
                ) : contentWithBoldLabels ? (
                  <div className="prose prose-charcoal prose-lg max-w-none text-secondary text-[1rem] [&_h1]:text-4xl [&_h1]:font-heading [&_h1]:!font-bold [&_h2]:text-3xl [&_h2]:font-heading [&_h2]:!font-bold [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-2xl [&_h3]:font-heading [&_h3]:!font-bold [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:text-[1rem] [&_p]:leading-[1.7] [&_p]:mb-4 [&_ul]:mb-4 [&_ol]:mb-4 [&_li]:text-[1rem] [&_li]:leading-[1.7] [&_blockquote]:text-[1rem] [&_blockquote]:leading-[1.7] [&_td]:text-[1rem] [&_strong]:text-[1rem]">
                    <LearnMarkdown content={contentWithBoldLabels} meta={meta} contentType={normalized} />
                  </div>
                ) : null}
                <JLPTVerificationBox verification={meta.jlpt_verification as { verifiedAt?: string; source?: string; reviewedBy?: string } | undefined} />
              </div>
            </div>

            <LessonMetaContent contentType={normalized} meta={meta} omitCharactersBlock={normalized === "sounds"} />

            {richContentBlocks.length > 0 && (
              <section className="mt-8 pt-8 border-t border-[var(--divider)]">
                <LessonBlockRenderer blocks={richContentBlocks} />
              </section>
            )}

            <BlogNextStepCta />

            {related.length > 0 && (
              <section className="mt-12 pt-10 border-t border-[var(--divider)]">
                <h2 className="font-heading text-2xl font-bold text-charcoal mb-6">
                  Recommended next lessons
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {related.map((r) => (
                    <LearnLessonCard key={r.id} item={r} />
                  ))}
                </div>
              </section>
            )}

            <section className="mt-12 pt-10 border-t border-[var(--divider)]">
              <h2 className="font-heading text-2xl font-bold text-charcoal mb-4">Comments</h2>
              <BlogCommentList comments={comments} />
              <div className="mt-6">
                <h3 className="font-heading text-lg font-semibold text-charcoal mb-3">Add a comment</h3>
                <LearnCommentForm contentType={normalized} slug={slug} />
              </div>
              {isReviewEntityType(normalized) && <ReportIssueButton entityType={normalized} entityId={item.id} />}
            </section>
          </div>

          <aside>
            <LearnStickyCta contentType={normalized} />
          </aside>
        </div>
      </div>
    </div>
  );
}
