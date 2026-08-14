/**
 * Imports a `social_content_packs` row into the new brief/variant model.
 *
 * The old generator asked one LLM call for every platform at once, in a ~100-key JSON schema.
 * That call silently drops keys — `scripts/fill-missing-social-platforms.ts` exists solely
 * because of it — so an imported pack is routinely missing whole platforms.
 *
 * This importer therefore reports what it did NOT find rather than manufacturing empty variants
 * for it. An empty `facebook.post` that looks generated is worse than an obvious gap: the gap
 * tells you to press Generate, the empty row tells you the work is done.
 *
 * Nothing is destroyed. `social_content_packs` stays exactly as it is, and `legacy_pack_id` plus
 * its unique index make a second import of the same pack a no-op rather than a duplicate.
 */
import { sql } from "@/lib/db";
import { enforceSurface } from "./clamp";
import { saveVariant } from "./briefs";
import { isSurfaceId, type SocialLang, type SurfaceId } from "./platforms";
import type { SocialBriefRow, SurfaceContent } from "./types";

type Json = Record<string, unknown>;

function obj(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
}
function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function tags(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string") return value.split(/[\s,]+/).filter(Boolean);
  return [];
}

interface Mapped {
  surface: SurfaceId;
  lang: SocialLang;
  content: SurfaceContent;
  hashtags: string[];
}

/**
 * Pulls every surface it can find out of one legacy payload.
 *
 * `caption_hinglish` is the old schema's only language marker, so those become the `hinglish`
 * variant and everything else `en`. That is what the data actually says — inventing an English
 * twin by translating would be fabricating content the pack never contained.
 */
export function mapLegacyPayload(payload: Json): { mapped: Mapped[]; skipped: string[] } {
  const mapped: Mapped[] = [];
  const skipped: string[] = [];

  const push = (surface: string, lang: SocialLang, content: SurfaceContent, hashtags: string[] = []) => {
    if (!isSurfaceId(surface)) return;
    const hasContent = Object.values(content).some((v) =>
      Array.isArray(v) ? v.length > 0 : typeof v === "string" && v.trim().length > 0
    );
    if (!hasContent) {
      skipped.push(surface);
      return;
    }
    mapped.push({ surface, lang, content, hashtags });
  };

  const yt = obj(payload.youtube);
  const ytLong = obj(yt?.long);
  push("youtube.long", "en", {
    title: str(ytLong?.title) ?? "",
    description: str(ytLong?.description) ?? "",
    chapters: Array.isArray(ytLong?.chapters) ? (ytLong!.chapters as unknown[]).map(String).join("\n") : "",
    pinnedComment: str(ytLong?.pinned_comment) ?? "",
  }, tags(ytLong?.tags));

  const ytShort = obj(yt?.short);
  push("youtube.short", "en", {
    title: str(ytShort?.title) ?? "",
    description: str(ytShort?.description) ?? str(ytShort?.script) ?? "",
  }, tags(ytShort?.hashtags));

  const ig = obj(payload.instagram);
  const reel = obj(ig?.reel);
  push("instagram.reel", "hinglish", {
    hook: str(reel?.hook_text) ?? "",
    caption: str(reel?.caption_hinglish) ?? str(reel?.caption) ?? "",
    cta: str(reel?.cta_line) ?? "",
  }, tags(reel?.hashtags));

  const igPost = obj(ig?.post);
  push("instagram.post", "hinglish", {
    caption: str(igPost?.caption_hinglish) ?? str(igPost?.caption) ?? "",
    cta: str(igPost?.cta_line) ?? "",
    imagePrompt: str(igPost?.image_prompt) ?? "",
  }, tags(igPost?.hashtags));

  const carousel = obj(ig?.carousel);
  const slides = Array.isArray(carousel?.slides) ? (carousel!.slides as unknown[]) : [];
  push("instagram.carousel", "hinglish", {
    coverTitle: str(obj(carousel?.cover)?.title) ?? str(carousel?.cover) ?? "",
    caption: str(carousel?.caption_hinglish) ?? str(carousel?.caption) ?? "",
    slides: slides.map((s) => {
      const slide = obj(s) ?? {};
      return { title: str(slide.title) ?? "", body: str(slide.body) ?? str(slide.text) ?? "" };
    }),
  }, tags(carousel?.hashtags));

  const tw = obj(payload.twitter);
  push("x.post", "en", { text: str(obj(tw?.post)?.text) ?? "" }, tags(obj(tw?.post)?.hashtags));
  const tweets = Array.isArray(obj(tw?.thread)?.tweets) ? (obj(tw?.thread)!.tweets as unknown[]) : [];
  push("x.thread", "en", {
    tweets: tweets.map((t) => str(obj(t)?.text) ?? String(t ?? "")).filter(Boolean),
  });

  const fb = obj(obj(payload.facebook)?.post);
  push("facebook.post", "en", { text: str(fb?.text) ?? "", cta: str(fb?.cta_line) ?? "" });

  const th = obj(obj(payload.threads)?.post);
  push("threads.post", "en", { text: str(th?.text) ?? "" });

  const pin = obj(obj(payload.pinterest)?.pin);
  push("pinterest.pin", "en", { title: str(pin?.title) ?? "", description: str(pin?.description) ?? "" });

  const li = obj(payload.linkedin);
  const liPost = obj(li?.post);
  push("linkedin.post", "en", { text: str(liPost?.text) ?? "", cta: str(liPost?.cta_line) ?? "" }, tags(liPost?.hashtags));
  const liArticle = obj(li?.article);
  push("linkedin.article", "en", {
    title: str(liArticle?.title) ?? "",
    hook: str(liArticle?.hook) ?? str(liArticle?.tldr) ?? "",
    body: str(liArticle?.body) ?? "",
  }, tags(liArticle?.hashtags));

  const reddit = obj(obj(payload.reddit)?.post);
  push("reddit.post", "en", { title: str(reddit?.title) ?? "", body: str(reddit?.body) ?? "" });

  const blog = obj(payload.blog);
  push("blog.article", "en", {
    title: str(blog?.title) ?? "",
    seoTitle: str(blog?.meta_title) ?? "",
    seoDescription: str(blog?.meta_description) ?? "",
    tldr: str(blog?.tldr) ?? "",
    body: str(blog?.html_body) ?? "",
  }, tags(blog?.tags));

  // TikTok never existed in the old schema, so it is a genuine absence rather than a dropped key.
  skipped.push("tiktok.video");

  return { mapped, skipped };
}

export interface ImportResult {
  briefId: string;
  imported: SurfaceId[];
  /** Surfaces the pack had nothing for. Shown in the UI so the gaps are obvious. */
  skipped: string[];
  alreadyImported: boolean;
}

export async function importLegacyPack(packId: string, actor: string): Promise<ImportResult> {
  if (!sql) throw new Error("Database unavailable");
  const db = sql;

  const existing = (await db`SELECT id FROM social_briefs WHERE legacy_pack_id = ${packId}`) as { id: string }[];
  if (existing.length > 0) {
    return { briefId: existing[0].id, imported: [], skipped: [], alreadyImported: true };
  }

  const packs = (await db`
    SELECT id, entity_type, entity_id, slug, title, summary, description, link, payload
    FROM social_content_packs WHERE id = ${packId}
  `) as Json[];
  if (packs.length === 0) throw new Error("Pack not found");
  const pack = packs[0];

  const briefs = (await db`
    INSERT INTO social_briefs (
      source_type, source_ref, legacy_pack_id, title, summary, body_context, link_path, status, created_by
    ) VALUES (
      'legacy_pack',
      ${JSON.stringify({ entityType: pack.entity_type, entityId: pack.entity_id, slug: pack.slug })}::jsonb,
      ${packId}, ${String(pack.title ?? "Imported pack")},
      ${str(pack.summary) ?? str(pack.description) ?? null},
      ${str(pack.description) ?? null},
      ${str(pack.link) ?? null},
      'ready', ${actor}
    )
    RETURNING *
  `) as Json[];
  const brief = briefs[0] as unknown as SocialBriefRow & { id: string };

  const { mapped, skipped } = mapLegacyPayload((pack.payload as Json) ?? {});
  const imported: SurfaceId[] = [];

  for (const item of mapped) {
    // Run through the same enforcement a fresh generation gets: the old generator never checked
    // a length, so imported copy is exactly where an over-limit tweet is likely to be hiding.
    const enforced = enforceSurface(item.surface, item.lang, { content: item.content, hashtags: item.hashtags });
    await saveVariant({
      briefId: brief.id,
      surface: item.surface,
      lang: item.lang,
      content: enforced.content,
      hashtags: enforced.hashtags,
      clampReport: enforced.violations,
      source: "imported",
      createdBy: actor,
    });
    imported.push(item.surface);
  }

  return { briefId: brief.id, imported, skipped, alreadyImported: false };
}
