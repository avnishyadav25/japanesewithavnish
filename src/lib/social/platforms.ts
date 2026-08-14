/**
 * Per-platform publishing rules — limits, cadence, tone, media shape.
 *
 * The unit here is a SURFACE, not a platform: `instagram.reel` and `instagram.carousel` want
 * different copy, different media and different lengths, so they are different rows. One surface
 * is one prompt key, one LLM call and one row of this table. That single choice is what keeps
 * nine platforms from becoming nine special cases.
 *
 * WHY THIS FILE EXISTS
 * Before it, the codebase had no per-platform character limits anywhere. The numbers lived as
 * prose inside prompt strings ("Instagram caption under 150 chars", "Threads post under 500")
 * and were never enforced after generation — so "under 280" was a polite request to a language
 * model, and the first time you learned it had been ignored was when X rejected the post.
 *
 * Cadence, tone and the allowed/forbidden lists are transcribed from
 * docs/30-day-social-media-promotion-plan.md §2 and §4, which had never been readable by code.
 *
 * MAINTENANCE
 * Platform limits drift constantly (TikTok's caption cap went 150 -> 2200 -> 4000 in two years).
 * Every surface therefore carries `limitsVerifiedOn` and `docsUrl`. Treat a stale date as a bug.
 *
 * Import discipline: no `next/*`, no `@/` alias, no DB. The render/publish worker loads this
 * under plain tsx by relative path.
 */
import type { SocialFormatId } from "../ai/social-formats";
import type { VideoFormat } from "../video/types";

export type PlatformId =
  | "youtube"
  | "instagram"
  | "x"
  | "facebook"
  | "threads"
  | "tiktok"
  | "pinterest"
  | "linkedin"
  | "reddit"
  | "blog";

export type SurfaceId =
  | "youtube.long"
  | "youtube.short"
  | "instagram.reel"
  | "instagram.post"
  | "instagram.carousel"
  | "x.post"
  | "x.thread"
  | "facebook.post"
  | "threads.post"
  | "tiktok.video"
  | "pinterest.pin"
  | "linkedin.post"
  | "linkedin.article"
  | "reddit.post"
  | "blog.article";

/**
 * Both variants are generated for every surface and the admin picks.
 *
 * `hinglish` means **romanised** Hindi-English, matching the existing `caption_hinglish`
 * convention in the current social pack. Devanagari is deliberately excluded: it would eat an
 * X post's 280 characters alive, and the audience this voice exists for reads romanised.
 */
export type SocialLang = "en" | "hinglish";

export const SOCIAL_LANGS: readonly SocialLang[] = ["en", "hinglish"];

export interface FieldRule {
  key: string;
  label: string;
  maxChars: number;
  minChars?: number;
  required: boolean;
  multiline: boolean;
  /**
   * `clamp`  trim at a word boundary (never inside a URL)
   * `reject` fail the variant — used where a truncated value is worse than none
   * `warn`   keep it, surface it in the UI
   */
  overflow: "clamp" | "reject" | "warn";
  /** A repeated field: carousel slides, thread tweets. `maxChars` applies per item. */
  repeatable?: { min: number; max: number; itemKeys: string[] };
}

export interface PlatformSurfaceRule {
  id: SurfaceId;
  platform: PlatformId;
  label: string;
  fields: FieldRule[];
  hashtags: {
    min: number;
    max: number;
    /** Where they belong. Instagram convention puts them in the first comment. */
    placement: "in_body" | "first_comment" | "separate_field" | "none";
  };
  media: {
    kind: "video" | "image" | "carousel" | "none";
    formatId?: SocialFormatId;
    aspectRatios: string[];
    /** Which rendered video format feeds this surface. */
    videoFormat?: VideoFormat;
    maxItems?: number;
    maxDurationSeconds?: number;
    maxBytes?: number;
  };
  cadence: {
    perWeek: number;
    /** 0 = Sunday. Empty means any day. */
    preferredWeekdays?: number[];
    note: string;
  };
  tone: string;
  allowed: string[];
  forbidden: string[];
  /** Instagram and TikTok captions do not linkify. Drives "link in bio" copy. */
  linksClickable: boolean;
  utmSource: string;
  generation: {
    promptKey: string;
    maxTokens: number;
    /**
     * One call per language instead of one call returning both.
     *
     * Set only for surfaces whose payload is large enough that asking for two languages at once
     * risks the omitted-keys failure that produced scripts/fill-missing-social-platforms.ts.
     */
    splitByLanguage: boolean;
  };
  autoPost: {
    /** An adapter exists in code. */
    implemented: boolean;
    /** Ships enabled once credentials exist. False for Reddit, permanently. */
    defaultEnabled: boolean;
    approvalRequirement: string;
  };
  limitsVerifiedOn: string;
  docsUrl: string;
}

const f = (
  key: string,
  label: string,
  maxChars: number,
  opts: Partial<Omit<FieldRule, "key" | "label" | "maxChars">> = {}
): FieldRule => ({
  key,
  label,
  maxChars,
  required: opts.required ?? true,
  multiline: opts.multiline ?? true,
  overflow: opts.overflow ?? "clamp",
  minChars: opts.minChars,
  repeatable: opts.repeatable,
});

export const PLATFORM_RULES: Record<SurfaceId, PlatformSurfaceRule> = {
  // -------------------------------------------------------------------------
  // YouTube
  // -------------------------------------------------------------------------
  "youtube.long": {
    id: "youtube.long",
    platform: "youtube",
    label: "YouTube — full video",
    fields: [
      // Titles are hard-capped by the API at 100; a clamp here beats a 400 from the upload.
      f("title", "Title", 100, { multiline: false, overflow: "clamp" }),
      f("description", "Description", 5000),
      f("chapters", "Chapters", 1000, { required: false }),
      f("pinnedComment", "Pinned comment", 500, { required: false }),
      f("thumbnailText", "Thumbnail text", 40, { required: false, multiline: false }),
    ],
    hashtags: { min: 0, max: 3, placement: "in_body" },
    media: { kind: "video", formatId: "landscape", aspectRatios: ["16:9"], videoFormat: "landscape" },
    cadence: { perWeek: 1, note: "Long-form is the anchor, not the volume play." },
    tone: "Clear, teacherly, structured. Assume the viewer chose to sit down and learn.",
    allowed: ["chapters", "timestamps", "links to the lesson page", "a pinned comment with the CTA"],
    forbidden: ["clickbait that the video does not deliver", "hashtag stuffing in the title"],
    linksClickable: true,
    utmSource: "youtube",
    generation: { promptKey: "social_youtube_long", maxTokens: 2200, splitByLanguage: true },
    autoPost: {
      implemented: false,
      defaultEnabled: true,
      approvalRequirement:
        "Google OAuth + a YouTube Data API audit. Until the audit passes, API uploads are forced to private. Quota also caps uploads at ~6/day (10,000 units, 1,600 per upload).",
    },
    limitsVerifiedOn: "2026-08",
    docsUrl: "https://developers.google.com/youtube/v3/docs/videos",
  },
  "youtube.short": {
    id: "youtube.short",
    platform: "youtube",
    label: "YouTube — Short",
    fields: [
      f("title", "Title", 100, { multiline: false }),
      f("description", "Description", 5000),
    ],
    hashtags: { min: 2, max: 4, placement: "in_body" },
    media: { kind: "video", formatId: "story", aspectRatios: ["9:16"], videoFormat: "vertical", maxDurationSeconds: 180 },
    cadence: { perWeek: 3, note: "Shorts carry discovery; long-form converts it." },
    tone: "Punchy. The first three words decide whether anyone stays.",
    allowed: ["#Shorts", "a single clear takeaway"],
    forbidden: ["chapters", "long preamble"],
    linksClickable: true,
    utmSource: "youtube",
    generation: { promptKey: "social_youtube_short", maxTokens: 1200, splitByLanguage: false },
    autoPost: {
      implemented: false,
      defaultEnabled: true,
      approvalRequirement: "Same YouTube Data API audit as long-form. Shorts is a URL shape, not a separate API.",
    },
    limitsVerifiedOn: "2026-08",
    docsUrl: "https://developers.google.com/youtube/v3/docs/videos",
  },

  // -------------------------------------------------------------------------
  // Instagram
  // -------------------------------------------------------------------------
  "instagram.reel": {
    id: "instagram.reel",
    platform: "instagram",
    label: "Instagram — Reel",
    fields: [
      f("hook", "Hook (first line)", 80, { multiline: false }),
      f("caption", "Caption", 2200),
      f("cta", "CTA line", 120, { required: false, multiline: false }),
      f("altText", "Alt text", 1000, { required: false }),
    ],
    hashtags: { min: 3, max: 6, placement: "in_body" },
    media: {
      kind: "video",
      formatId: "story",
      aspectRatios: ["9:16"],
      videoFormat: "vertical",
      maxDurationSeconds: 90,
      maxBytes: 100 * 1024 * 1024,
    },
    cadence: { perWeek: 7, note: "Daily. Reels are the discovery engine for this audience." },
    tone: "Warm, direct, a friend who happens to know Japanese.",
    allowed: ["one idea per reel", "an on-screen hook", "link in bio"],
    // The caption is plain text on Instagram: a pasted URL is dead characters.
    forbidden: ["clickable links in the caption", "walls of text before the hook"],
    linksClickable: false,
    utmSource: "instagram",
    generation: { promptKey: "social_instagram_reel", maxTokens: 1400, splitByLanguage: false },
    autoPost: {
      implemented: false,
      defaultEnabled: true,
      approvalRequirement:
        "Meta app with Advanced Access for instagram_content_publish, plus a Business/Creator account linked to a Facebook Page.",
    },
    limitsVerifiedOn: "2026-08",
    docsUrl: "https://developers.facebook.com/docs/instagram-platform/content-publishing",
  },
  "instagram.post": {
    id: "instagram.post",
    platform: "instagram",
    label: "Instagram — feed post",
    fields: [
      f("caption", "Caption", 2200),
      f("cta", "CTA line", 120, { required: false, multiline: false }),
      f("imagePrompt", "Image prompt", 900, { required: false }),
    ],
    hashtags: { min: 3, max: 6, placement: "in_body" },
    media: { kind: "image", formatId: "square", aspectRatios: ["1:1", "4:5"] },
    cadence: { perWeek: 4, note: "Fills the grid between reels." },
    tone: "Warm, direct.",
    allowed: ["a single teaching point", "link in bio"],
    forbidden: ["clickable links in the caption"],
    linksClickable: false,
    utmSource: "instagram",
    generation: { promptKey: "social_instagram_post", maxTokens: 1200, splitByLanguage: false },
    autoPost: {
      implemented: false,
      defaultEnabled: true,
      approvalRequirement: "Meta Advanced Access (instagram_content_publish).",
    },
    limitsVerifiedOn: "2026-08",
    docsUrl: "https://developers.facebook.com/docs/instagram-platform/content-publishing",
  },
  "instagram.carousel": {
    id: "instagram.carousel",
    platform: "instagram",
    label: "Instagram — carousel",
    fields: [
      f("coverTitle", "Cover title", 60, { multiline: false }),
      f("caption", "Caption", 2200),
      // Per-slide caps; the repeatable block is what clamp.ts iterates.
      f("slides", "Slides", 180, {
        repeatable: { min: 5, max: 10, itemKeys: ["title", "body"] },
      }),
    ],
    hashtags: { min: 3, max: 6, placement: "in_body" },
    media: { kind: "carousel", formatId: "square", aspectRatios: ["4:5", "1:1"], maxItems: 10 },
    cadence: { perWeek: 2, note: "Carousels are saved and re-read; use them for reference material." },
    tone: "Teacherly, sequential. Each slide earns the swipe to the next.",
    allowed: ["numbered progression", "one point per slide", "a recap slide"],
    forbidden: ["more than one idea per slide", "slides that only make sense with the caption"],
    linksClickable: false,
    utmSource: "instagram",
    // 10 slides x 2 fields x 2 languages in one response is exactly the payload size that
    // produced the documented omitted-keys failure. One language per call.
    generation: { promptKey: "social_instagram_carousel", maxTokens: 2600, splitByLanguage: true },
    autoPost: {
      implemented: false,
      defaultEnabled: true,
      approvalRequirement: "Meta Advanced Access (instagram_content_publish).",
    },
    limitsVerifiedOn: "2026-08",
    docsUrl: "https://developers.facebook.com/docs/instagram-platform/content-publishing",
  },

  // -------------------------------------------------------------------------
  // X
  // -------------------------------------------------------------------------
  "x.post": {
    id: "x.post",
    platform: "x",
    label: "X — single post",
    // 280 is the free-tier limit. Counting is grapheme-based in clamp.ts: "👨‍👩‍👧".length is 8
    // in JavaScript and 2 here, and using .length would silently waste a third of every post.
    fields: [f("text", "Post", 280, { overflow: "reject" })],
    hashtags: { min: 1, max: 3, placement: "in_body" },
    media: { kind: "video", formatId: "landscape", aspectRatios: ["16:9"], videoFormat: "landscape" },
    cadence: { perWeek: 7, note: "Daily; cheap to post, cheap to ignore." },
    tone: "Concise and useful. One fact, well put.",
    allowed: ["a single Japanese example", "a clickable link"],
    forbidden: ["threads pretending to be single posts", "more than three hashtags"],
    linksClickable: true,
    utmSource: "twitter",
    generation: { promptKey: "social_x_post", maxTokens: 700, splitByLanguage: false },
    autoPost: {
      implemented: false,
      defaultEnabled: true,
      approvalRequirement: "An X developer app. The free tier allows ~500 posts a month, which is ample.",
    },
    limitsVerifiedOn: "2026-08",
    docsUrl: "https://docs.x.com/x-api/posts/creation-of-a-post",
  },
  "x.thread": {
    id: "x.thread",
    platform: "x",
    label: "X — thread",
    fields: [
      f("tweets", "Tweets", 280, {
        overflow: "reject",
        repeatable: { min: 2, max: 8, itemKeys: ["text"] },
      }),
    ],
    hashtags: { min: 1, max: 3, placement: "in_body" },
    media: { kind: "video", formatId: "landscape", aspectRatios: ["16:9"], videoFormat: "landscape" },
    cadence: { perWeek: 2, note: "Threads are for the explanation a single post cannot carry." },
    tone: "Builds. Each post is readable alone but wants the next.",
    allowed: ["a numbered walkthrough", "the CTA on the final post only"],
    forbidden: ["a hook post that never pays off", "hashtags on every post"],
    linksClickable: true,
    utmSource: "twitter",
    generation: { promptKey: "social_x_thread", maxTokens: 1800, splitByLanguage: true },
    autoPost: {
      implemented: false,
      defaultEnabled: true,
      approvalRequirement: "An X developer app. Threads post as a reply chain.",
    },
    limitsVerifiedOn: "2026-08",
    docsUrl: "https://docs.x.com/x-api/posts/creation-of-a-post",
  },

  // -------------------------------------------------------------------------
  // Facebook / Threads
  // -------------------------------------------------------------------------
  "facebook.post": {
    id: "facebook.post",
    platform: "facebook",
    label: "Facebook — Page post",
    fields: [
      // The hard cap is 63,206; 2,000 is an editorial limit, because nobody reads more.
      f("text", "Post", 2000, { overflow: "warn" }),
      f("cta", "CTA line", 120, { required: false, multiline: false }),
    ],
    hashtags: { min: 0, max: 3, placement: "in_body" },
    media: { kind: "video", formatId: "square", aspectRatios: ["1:1", "1.91:1"], videoFormat: "square" },
    cadence: { perWeek: 5, note: "Skews older and more patient than Instagram; longer copy works." },
    tone: "Friendly and a little more explanatory than Instagram.",
    allowed: ["clickable links", "a longer setup"],
    forbidden: ["engagement bait", "identical copy to the Instagram caption"],
    linksClickable: true,
    utmSource: "facebook",
    generation: { promptKey: "social_facebook_post", maxTokens: 1200, splitByLanguage: false },
    autoPost: {
      implemented: false,
      defaultEnabled: true,
      approvalRequirement: "Meta app with pages_manage_posts, shared with the Instagram approval.",
    },
    limitsVerifiedOn: "2026-08",
    docsUrl: "https://developers.facebook.com/docs/pages-api/posts",
  },
  "threads.post": {
    id: "threads.post",
    platform: "threads",
    label: "Threads — post",
    fields: [f("text", "Post", 500, { overflow: "reject" })],
    hashtags: { min: 0, max: 1, placement: "in_body" },
    media: { kind: "video", formatId: "square", aspectRatios: ["1:1", "9:16"], videoFormat: "square" },
    cadence: { perWeek: 5, note: "Conversational; posts that ask something outperform posts that tell." },
    tone: "Casual, first-person, closer to a thought than a broadcast.",
    allowed: ["a question to the reader", "clickable links"],
    // Threads' own convention is one tag at most; stacks read as spam there.
    forbidden: ["hashtag stacks", "reposted Instagram captions"],
    linksClickable: true,
    utmSource: "threads",
    generation: { promptKey: "social_threads_post", maxTokens: 700, splitByLanguage: false },
    autoPost: {
      implemented: false,
      defaultEnabled: true,
      approvalRequirement: "Threads API via a Meta app, shared with the Instagram/Facebook approval.",
    },
    limitsVerifiedOn: "2026-08",
    docsUrl: "https://developers.facebook.com/docs/threads",
  },

  // -------------------------------------------------------------------------
  // TikTok
  // -------------------------------------------------------------------------
  "tiktok.video": {
    id: "tiktok.video",
    platform: "tiktok",
    label: "TikTok — video",
    fields: [f("caption", "Caption", 2200)],
    hashtags: { min: 3, max: 5, placement: "in_body" },
    media: {
      kind: "video",
      formatId: "story",
      aspectRatios: ["9:16"],
      videoFormat: "vertical",
      maxDurationSeconds: 600,
    },
    cadence: { perWeek: 3, note: "Same vertical cut as Reels; the caption is the only thing that changes." },
    tone: "Fast, informal, native to the platform.",
    allowed: ["trend-aware phrasing", "a hook in the first second"],
    forbidden: ["clickable links in the caption", "reposting with a visible watermark from elsewhere"],
    linksClickable: false,
    utmSource: "tiktok",
    generation: { promptKey: "social_tiktok_video", maxTokens: 900, splitByLanguage: false },
    autoPost: {
      implemented: false,
      defaultEnabled: true,
      approvalRequirement:
        "TikTok Content Posting API audit. Before it passes, an unaudited app can only post SELF_ONLY (private). Also requires verifying the R2 domain before PULL_FROM_URL works.",
    },
    limitsVerifiedOn: "2026-08",
    docsUrl: "https://developers.tiktok.com/doc/content-posting-api-get-started",
  },

  // -------------------------------------------------------------------------
  // Pinterest / LinkedIn
  // -------------------------------------------------------------------------
  "pinterest.pin": {
    id: "pinterest.pin",
    platform: "pinterest",
    label: "Pinterest — pin",
    fields: [
      f("title", "Title", 100, { multiline: false }),
      f("description", "Description", 500),
    ],
    hashtags: { min: 0, max: 2, placement: "in_body" },
    // 2:3 per the 30-day doc; Pinterest downranks other ratios in the feed.
    media: { kind: "image", formatId: "pin", aspectRatios: ["2:3"] },
    cadence: { perWeek: 7, note: "Daily. Pins have a long tail — this is search, not social." },
    tone: "Write titles like mini blog headlines, not social captions.",
    allowed: ["keyword-led titles", "clickable links", "evergreen reference material"],
    forbidden: ["time-sensitive copy", "social-media phrasing"],
    linksClickable: true,
    utmSource: "pinterest",
    generation: { promptKey: "social_pinterest_pin", maxTokens: 800, splitByLanguage: false },
    autoPost: {
      implemented: false,
      defaultEnabled: true,
      approvalRequirement: "A Pinterest app with standard access.",
    },
    limitsVerifiedOn: "2026-08",
    docsUrl: "https://developers.pinterest.com/docs/api/v5/pins-create",
  },
  "linkedin.post": {
    id: "linkedin.post",
    platform: "linkedin",
    label: "LinkedIn — post",
    fields: [
      f("text", "Post", 3000),
      f("cta", "CTA line", 120, { required: false, multiline: false }),
    ],
    hashtags: { min: 3, max: 5, placement: "in_body" },
    media: { kind: "image", formatId: "og", aspectRatios: ["1.91:1", "1:1"] },
    cadence: { perWeek: 3, preferredWeekdays: [1, 3, 5], note: "Mon/Wed/Fri per the 30-day plan." },
    tone: "Founder voice. Professional, reflective, never salesy.",
    allowed: ["what building this taught you", "data", "a genuine question"],
    forbidden: ["hard selling", "discount codes", "engagement bait"],
    linksClickable: true,
    utmSource: "linkedin",
    generation: { promptKey: "social_linkedin_post", maxTokens: 1400, splitByLanguage: false },
    autoPost: {
      implemented: false,
      defaultEnabled: true,
      approvalRequirement: "LinkedIn app with w_member_social (or the Community Management API for a company page).",
    },
    limitsVerifiedOn: "2026-08",
    docsUrl: "https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api",
  },
  "linkedin.article": {
    id: "linkedin.article",
    platform: "linkedin",
    label: "LinkedIn — article",
    fields: [
      f("title", "Title", 150, { multiline: false }),
      f("hook", "Opening hook", 300),
      f("body", "Body", 110000),
    ],
    hashtags: { min: 3, max: 5, placement: "separate_field" },
    media: { kind: "image", formatId: "og", aspectRatios: ["1.91:1"] },
    // Same Mon/Wed/Fri window as a LinkedIn post — an article landing on a Saturday is read by
    // nobody there, regardless of how long it took to write.
    cadence: { perWeek: 0.5, preferredWeekdays: [1, 3, 5], note: "Occasional. An article is a month's authority, not a week's post." },
    tone: "Founder voice, long form, structured with subheadings.",
    allowed: ["subheadings", "a personal angle", "links to the lesson"],
    forbidden: ["hard selling", "spun blog content"],
    linksClickable: true,
    utmSource: "linkedin",
    generation: { promptKey: "social_linkedin_article", maxTokens: 3000, splitByLanguage: true },
    autoPost: { implemented: false, defaultEnabled: false, approvalRequirement: "LinkedIn article publishing is not exposed by the API; post by hand." },
    limitsVerifiedOn: "2026-08",
    docsUrl: "https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api",
  },

  // -------------------------------------------------------------------------
  // Reddit
  // -------------------------------------------------------------------------
  "reddit.post": {
    id: "reddit.post",
    platform: "reddit",
    label: "Reddit — post",
    fields: [
      f("title", "Title", 300, { multiline: false, overflow: "reject" }),
      f("body", "Body", 40000),
      f("subreddit", "Subreddit", 40, { required: false, multiline: false }),
    ],
    hashtags: { min: 0, max: 0, placement: "none" },
    media: { kind: "none", aspectRatios: [] },
    cadence: { perWeek: 2, note: "Sparingly, and only where it genuinely helps someone." },
    tone: "A person answering a question. Not a brand, not an announcement.",
    allowed: ["a genuinely useful chart or explanation", "answering the actual question asked"],
    forbidden: ["ad copy", "posters or promo graphics", "discount codes", "linking to the site as the point of the post"],
    linksClickable: true,
    utmSource: "reddit",
    generation: { promptKey: "social_reddit_post", maxTokens: 1600, splitByLanguage: false },
    autoPost: {
      implemented: false,
      // Off permanently by default, not pending an approval. Reddit removes and shadow-bans
      // accounts that post promotional content on a schedule; docs/30-day-social-media-
      // promotion-plan.md §2 says "No ad copy, never a poster". Flip it deliberately or not at all.
      defaultEnabled: false,
      approvalRequirement:
        "Auto-posting is disabled on purpose, not blocked by Reddit. Scheduled promotional posting is the fastest route to a shadow ban. Post by hand, as a person.",
    },
    limitsVerifiedOn: "2026-08",
    docsUrl: "https://www.reddit.com/dev/api/#POST_api_submit",
  },

  // -------------------------------------------------------------------------
  // The site itself — an article is just another surface
  // -------------------------------------------------------------------------
  "blog.article": {
    id: "blog.article",
    platform: "blog",
    label: "Site — blog article",
    fields: [
      f("title", "Title", 120, { multiline: false }),
      // Matches clampTitle/clampDescription defaults in src/lib/seo.ts, so the article obeys the
      // same SEO rules the rest of the site is audited against.
      f("seoTitle", "SEO title", 60, { multiline: false }),
      f("seoDescription", "SEO description", 158),
      f("tldr", "TL;DR", 400),
      f("body", "Body (HTML)", 60000),
    ],
    hashtags: { min: 0, max: 0, placement: "none" },
    media: { kind: "image", formatId: "og", aspectRatios: ["1.91:1"] },
    cadence: { perWeek: 1, note: "One article per video is plenty; the video is the primary artifact." },
    tone: "The site's teaching voice — the same one used for lesson pages.",
    allowed: ["headings", "example sentences", "an embedded video"],
    forbidden: ["duplicating an existing lesson page", "thin content padded to look long"],
    linksClickable: true,
    utmSource: "blog",
    generation: { promptKey: "social_blog_article", maxTokens: 4000, splitByLanguage: true },
    autoPost: {
      implemented: true,
      defaultEnabled: true,
      approvalRequirement: "None — it writes a draft posts row on this site. Publishing still goes through the review gate.",
    },
    limitsVerifiedOn: "2026-08",
    docsUrl: "",
  },
};

export const SURFACES: readonly SurfaceId[] = Object.keys(PLATFORM_RULES) as SurfaceId[];

export const PLATFORMS: readonly PlatformId[] = [
  "youtube", "instagram", "x", "facebook", "threads", "tiktok", "pinterest", "linkedin", "reddit", "blog",
];

export function getRule(surface: SurfaceId): PlatformSurfaceRule {
  const rule = PLATFORM_RULES[surface];
  if (!rule) throw new Error(`Unknown social surface: ${surface}`);
  return rule;
}

export function platformOf(surface: SurfaceId): PlatformId {
  return getRule(surface).platform;
}

export function surfacesForPlatform(platform: PlatformId): SurfaceId[] {
  return SURFACES.filter((s) => PLATFORM_RULES[s].platform === platform);
}

export function isSurfaceId(value: string): value is SurfaceId {
  return Object.prototype.hasOwnProperty.call(PLATFORM_RULES, value);
}

export function isPlatformId(value: string): value is PlatformId {
  return (PLATFORMS as readonly string[]).includes(value);
}

/** Surfaces a given rendered video format can feed, for the "promote this render" flow. */
export function surfacesForVideoFormat(format: VideoFormat): SurfaceId[] {
  return SURFACES.filter((s) => PLATFORM_RULES[s].media.videoFormat === format);
}
