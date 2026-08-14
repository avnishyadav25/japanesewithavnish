/**
 * The `blog.article` surface — the one that publishes to somewhere we own.
 *
 * Modelled as a surface rather than a special case, so it goes through the same brief, the same
 * generation, the same clamping and the same tracking as an Instagram caption. The only thing
 * that differs is where it lands: a `posts` row on this site instead of somebody's API.
 *
 * Lives in src/lib/social/ rather than adapters/ because unlike every other adapter it genuinely
 * needs the database, and the adapter contract deliberately forbids that (see adapters/types.ts).
 * The publish route calls this directly.
 */
import { sql } from "@/lib/db";
import { clampDescription, clampTitle } from "@/lib/seo";
import { slugify, uniqueSlug } from "@/lib/slugify";
import type { SocialBriefRow, SocialVariantRow } from "./types";

export interface PublishArticleResult {
  postId: string;
  slug: string;
  url: string;
  /** True when the video was embedded on the new post. */
  embedded: boolean;
}

function firstString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Turns an approved `blog.article` variant into a draft post.
 *
 * Draft, always. Publishing goes through the existing review gate at
 * /api/admin/posts/[slug] — generated long-form content is exactly what that gate exists for,
 * and routing around it here would make the gate optional in practice.
 */
export async function publishArticleDraft(
  brief: SocialBriefRow,
  variant: SocialVariantRow,
  actor: string
): Promise<PublishArticleResult> {
  if (!sql) throw new Error("Database unavailable");
  const db = sql;

  const title = firstString(variant.content.title);
  const body = firstString(variant.content.body);
  if (!title) throw new Error("The article has no title — regenerate the blog.article surface.");
  if (!body) throw new Error("The article has no body — regenerate the blog.article surface.");

  // Clamped through the same helpers the rest of the site is audited against, so a generated
  // article obeys the same SEO rules a hand-written one does. This also closes the known gap
  // where generated content never wrote seo_description at all.
  const seoTitle = clampTitle(firstString(variant.content.seoTitle) ?? title);
  const seoDescription = clampDescription(
    firstString(variant.content.seoDescription) ?? firstString(variant.content.tldr) ?? brief.summary ?? title
  );

  const slug = await uniqueSlug(slugify(title), async (candidate) => {
    const rows = (await db`SELECT 1 FROM posts WHERE slug = ${candidate} LIMIT 1`) as unknown[];
    return rows.length > 0;
  });

  // blog.article carries no hashtags by design, so tags come from what the brief already knows.
  // Left empty they were a small but real SEO gap on every generated article — the blog index
  // and the related-posts logic both key off tags.
  const tags = Array.from(
    new Set(
      [
        ...variant.hashtags.map((h) => h.replace(/^#/, "")),
        brief.contentType ?? null,
        brief.jlptLevel ? `JLPT ${brief.jlptLevel}` : null,
        "Japanese",
      ].filter((t): t is string => Boolean(t && t.trim()))
    )
  );
  const jlptLevel = brief.jlptLevel ? [brief.jlptLevel] : [];

  const rows = (await db`
    INSERT INTO posts (
      slug, title, summary, content, jlpt_level, tags, status,
      seo_title, seo_description, content_type, content_surface, author_name
    ) VALUES (
      ${slug}, ${title}, ${firstString(variant.content.tldr)}, ${body},
      ${jlptLevel}, ${tags}, 'draft',
      ${seoTitle}, ${seoDescription}, 'blog', 'blog_editorial', ${actor}
    )
    RETURNING id
  `) as { id: string }[];

  const postId = rows[0].id;

  // The article and the video ship together: the post it was generated from gets the render
  // embedded as its hero, using the same table the "Publish to site" button writes.
  let embedded = false;
  if (brief.renderId) {
    try {
      await db`
        INSERT INTO video_content_links (render_id, post_id, placement, is_published)
        VALUES (${brief.renderId}, ${postId}, 'hero', true)
        ON CONFLICT DO NOTHING
      `;
      embedded = true;
    } catch (err) {
      // A missing embed is a much smaller problem than a lost article, so it never fails the
      // insert — the post is already written and the embed can be added by hand.
      console.error("[social] could not embed render on new article:", err);
    }
  }

  return { postId, slug, url: `/blog/${slug}`, embedded };
}
