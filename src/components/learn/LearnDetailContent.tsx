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

type Meta = Record<string, unknown> | null;

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://japanesewithavnish.com";

/**
 * Shared renderer for a single learning-content lesson (grammar/vocabulary/kanji/reading/
 * writing/listening/sounds/study_guide/practice_test), used by both the canonical /learn/[type]/[slug]
 * route and the /blog/study_guide/[slug] route (study_guide stays under /blog as editorial content).
 */
export async function getLearnDetailMetadata({
  typeSegment,
  postSlug,
  canonicalBase,
}: {
  typeSegment: string;
  postSlug: string;
  canonicalBase: string;
}) {
  const normalized = typeSegment.toLowerCase();

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
  const url = `${BASE}${canonicalBase}/${normalized}/${postSlug}`;

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
  postSlug: slug,
  breadcrumbBase,
}: {
  typeSegment: string;
  postSlug: string;
  breadcrumbBase: string;
}) {
  const normalized = typeSegment.toLowerCase();

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

  const meta = (item.meta ?? {}) as Record<string, unknown>;
  const featureImageUrl =
    item.og_image_url ?? (typeof meta.feature_image_url === "string" ? meta.feature_image_url : null);

  if (normalized === "vocabulary") {
    // Same unification as kanji: prefer the authoritative `vocabulary` table's
    // part_of_speech/transitivity over posts.meta.type, which can be freeform/inconsistent.
    const vocabRows = (await sql`
      SELECT part_of_speech, transitivity FROM vocabulary WHERE post_id = ${item.id} LIMIT 1
    `) as { part_of_speech: string | null; transitivity: string | null }[];
    const vocabRow = vocabRows[0];
    if (vocabRow) {
      if (vocabRow.part_of_speech) meta.type = vocabRow.part_of_speech;
      if (vocabRow.transitivity) meta.transitivity = vocabRow.transitivity;
    }
  }

  if (normalized === "kanji") {
    // The posts.meta JSONB onyomi/kunyomi (author/AI-entered) can disagree in casing/format
    // with the dictionary-sourced `kanji` table used by the /learn/kana/kanji grid. Prefer
    // the authoritative table data so both surfaces show the same readings.
    const kanjiRows = (await sql`
      SELECT character, meaning, meaning_extended, stroke_count, onyomi, kunyomi
      FROM kanji WHERE post_id = ${item.id} LIMIT 1
    `) as { character: string; meaning: string | null; meaning_extended: string | null; stroke_count: number | null; onyomi: string[] | null; kunyomi: string[] | null }[];
    const kanjiRow = kanjiRows[0];
    if (kanjiRow) {
      if (kanjiRow.character) meta.character = kanjiRow.character;
      if (kanjiRow.meaning) meta.meaning = kanjiRow.meaning;
      if (kanjiRow.meaning_extended) meta.meaning_extended = kanjiRow.meaning_extended;
      if (kanjiRow.stroke_count != null) meta.stroke_count = kanjiRow.stroke_count;
      if (kanjiRow.onyomi && kanjiRow.onyomi.length > 0) meta.onyomi = kanjiRow.onyomi;
      if (kanjiRow.kunyomi && kanjiRow.kunyomi.length > 0) meta.kunyomi = kanjiRow.kunyomi;
    }
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
  const hasToc = reorderedContent.includes("## ");

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
                {contentWithBoldLabels ? (
                  <div className="prose prose-charcoal prose-lg max-w-none text-secondary text-[1rem] [&_h1]:text-4xl [&_h1]:font-heading [&_h1]:!font-bold [&_h2]:text-3xl [&_h2]:font-heading [&_h2]:!font-bold [&_h2]:mt-8 [&_h2]:mb-3 [&_h3]:text-2xl [&_h3]:font-heading [&_h3]:!font-bold [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:text-[1rem] [&_p]:leading-[1.7] [&_p]:mb-4 [&_ul]:mb-4 [&_ol]:mb-4 [&_li]:text-[1rem] [&_li]:leading-[1.7] [&_blockquote]:text-[1rem] [&_blockquote]:leading-[1.7] [&_td]:text-[1rem] [&_strong]:text-[1rem]">
                    <LearnMarkdown content={contentWithBoldLabels} meta={meta} contentType={normalized} />
                  </div>
                ) : null}
                <JLPTVerificationBox verification={meta.jlpt_verification as { verifiedAt?: string; source?: string; reviewedBy?: string } | undefined} />
              </div>
            </div>

            <LessonMetaContent contentType={normalized} meta={meta} omitCharactersBlock={normalized === "sounds"} />

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
